import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";
import {
  ODOO_ENTITIES,
  type OdooConnectionState,
  type OdooEntity,
  type SyncRunResult,
} from "@/lib/odoo/models";

const datasetSchema = z.object({
  dataset: z.enum(["employees", "attendance", "leave", "payroll"]),
  limit: z.number().int().min(1).max(200).optional(),
});

const entitySchema = z.object({ entity: z.enum(ODOO_ENTITIES) });
const recordSchema = z.object({ entity: z.enum(ODOO_ENTITIES), localId: z.string().uuid() });
const employeeSchema = z.object({ employeeId: z.string().uuid() });
const logFilterSchema = z.object({
  entity: z.enum(ODOO_ENTITIES).optional(),
  status: z.enum(["SUCCESS", "FAILED", "SKIPPED", "NOT_AVAILABLE"]).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  onlyErrors: z.boolean().default(false),
  limit: z.number().int().min(1).max(500).default(50),
});

/** JSON-serialisable shape of an Odoo record field. */
export type OdooValue = string | number | boolean | null | OdooValue[];
export type OdooRow = Record<string, OdooValue>;

export type EmployeeSyncOutcome = {
  employeeId: string;
  outcome: "CREATED" | "UPDATED" | "FAILED";
  odooId: number | null;
  message?: string;
};

export type OdooDataset = z.infer<typeof datasetSchema>["dataset"];

const MODEL_MAP: Record<OdooDataset, { model: string; fields: string[] }> = {
  employees: {
    model: "hr.employee",
    fields: ["id", "name", "work_email", "department_id", "job_title", "work_location_id"],
  },
  attendance: {
    model: "hr.attendance",
    fields: ["id", "employee_id", "check_in", "check_out", "worked_hours"],
  },
  leave: {
    model: "hr.leave",
    fields: [
      "id",
      "employee_id",
      "holiday_status_id",
      "request_date_from",
      "request_date_to",
      "state",
    ],
  },
  payroll: {
    model: "hr.payslip",
    fields: ["id", "employee_id", "date_from", "date_to", "state", "number"],
  },
};

async function actorEmail(claims: Record<string, unknown>): Promise<string | null> {
  return typeof claims["email"] === "string" ? (claims["email"] as string) : null;
}

/** Whether the Odoo connection is configured. Never returns any credential. */
export const getOdooStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { odooConfigStatus } = await import("@/lib/odoo/odooRpc.server");
    return { status: odooConfigStatus() };
  });

/**
 * Real Odoo authentication round-trip. Returns only a state and a safe message;
 * credentials, tokens and raw provider errors never leave the server.
 */
export const testOdooConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, odooPing, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    const { CONNECTION_MESSAGES } = await import("@/lib/odoo/models");

    if (odooConfigStatus() === "not_configured") {
      return {
        state: "NOT_CONFIGURED" as OdooConnectionState,
        message: CONNECTION_MESSAGES.NOT_CONFIGURED,
        checkedAt: new Date().toISOString(),
      };
    }

    let state: OdooConnectionState = "CONNECTED";
    let message = CONNECTION_MESSAGES.CONNECTED;

    try {
      await odooPing();
    } catch (cause) {
      state = cause instanceof OdooError && cause.code === "ODOO_UNAVAILABLE" ? "DISCONNECTED" : "ERROR";
      message =
        cause instanceof OdooError ? ODOO_ERROR_MESSAGES[cause.code] : CONNECTION_MESSAGES.ERROR;
    }

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "odoo.connection_tested",
      actorId: context.userId,
      actorEmail: await actorEmail(context.claims as Record<string, unknown>),
      entityType: "odoo",
      summary: `Connection test result: ${state}`,
    });

    return { state, message, checkedAt: new Date().toISOString() };
  });

/**
 * Integration dashboard data: configuration state, real mapping counts, last
 * sync timestamps and recent activity. Counts come from stored sync results
 * only — nothing is estimated or fabricated.
 */
export const getOdooOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus } = await import("@/lib/odoo/odooRpc.server");
    const configured = odooConfigStatus() === "configured";

    const { data: mappings } = await context.supabase
      .from("odoo_mappings")
      .select("entity_type, sync_status, last_synced_at");

    const stats = ODOO_ENTITIES.map((entity) => {
      const rows = (mappings ?? []).filter((row) => row.entity_type === entity);
      return {
        entity,
        synced: rows.filter((row) => row.sync_status === "SYNCED").length,
        failed: rows.filter((row) => row.sync_status === "FAILED").length,
        pending: rows.filter((row) => row.sync_status === "PENDING").length,
      };
    });

    const { data: lastSuccess } = await context.supabase
      .from("odoo_sync_logs")
      .select("created_at")
      .eq("status", "SUCCESS")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastAttempt } = await context.supabase
      .from("odoo_sync_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: errorCount } = await context.supabase
      .from("odoo_mappings")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "FAILED");

    let payrollAvailable: boolean | null = null;
    if (configured) {
      const { payrollSupported } = await import("@/lib/odoo/sync.server");
      payrollAvailable = await payrollSupported();
    }

    return {
      configured,
      payrollAvailable,
      stats,
      lastSuccessfulSyncAt: lastSuccess?.created_at ?? null,
      lastSyncAttemptAt: lastAttempt?.created_at ?? null,
      errorCount: errorCount ?? 0,
    };
  });

const bulkSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(20),
});

const candidateSchema = z.object({
  includeInactive: z.boolean().default(false),
  onlyFailedOrMissing: z.boolean().default(false),
});

/**
 * The employees a bulk sync would cover, so the browser can show honest
 * progress ("45 / 120") against a real total before the run starts.
 */
export const listEmployeeSyncCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => candidateSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("employees")
      .select("id, login_id, first_name, last_name, status")
      .order("first_name", { ascending: true })
      .limit(500);

    if (!data.includeInactive) query = query.in("status", ["ACTIVE", "ON_LEAVE"]);

    const { data: employees, error } = await query;
    if (error) throw new Error("We could not load the employees to synchronise.");

    const { data: mappings } = await context.supabase
      .from("odoo_mappings")
      .select("local_id, odoo_id, sync_status, last_synced_at")
      .eq("entity_type", "EMPLOYEE");

    const byLocalId = new Map((mappings ?? []).map((row) => [row.local_id, row]));

    const rows = (employees ?? []).map((employee) => {
      const mapping = byLocalId.get(employee.id);
      return {
        id: employee.id,
        loginId: employee.login_id,
        name: `${employee.first_name} ${employee.last_name}`.trim(),
        status: employee.status,
        odooId: mapping?.odoo_id ?? null,
        syncStatus: (mapping?.sync_status ?? "NOT_SYNCED") as
          | "SYNCED"
          | "PENDING"
          | "FAILED"
          | "NOT_SYNCED",
        lastSyncedAt: mapping?.last_synced_at ?? null,
      };
    });

    return data.onlyFailedOrMissing
      ? rows.filter((row) => row.syncStatus !== "SYNCED")
      : rows;
  });

/**
 * Syncs one small chunk of employees. The browser walks the chunks so it can
 * render live progress, while the server keeps its own bounded concurrency —
 * Odoo is never hit with an unbounded burst. Each record reports created vs
 * updated and a safe failure message (never raw provider output).
 */
export const syncEmployeeChunkToOdoo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return {
        ok: false as const,
        message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED,
        results: [] as EmployeeSyncOutcome[],
      };
    }

    const { syncEmployeeRecord } = await import("@/lib/odoo/sync.server");
    const actor = { userId: context.userId };

    // Bounded concurrency: at most 4 Odoo writes in flight per chunk.
    const ids = data.employeeIds;
    const results: EmployeeSyncOutcome[] = [];
    let cursor = 0;

    await Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (cursor < ids.length) {
          const id = ids[cursor++];
          if (!id) return;
          try {
            const { odooId, created } = await syncEmployeeRecord(id, actor);
            results.push({
              employeeId: id,
              outcome: created ? "CREATED" : "UPDATED",
              odooId: odooId ?? null,
            });
          } catch (cause) {
            results.push({
              employeeId: id,
              outcome: "FAILED",
              odooId: null,
              message:
                cause instanceof OdooError
                  ? ODOO_ERROR_MESSAGES[cause.code]
                  : "This employee could not be synchronised.",
            });
          }
        }
      }),
    );

    return { ok: true as const, results };
  });

/** Records the outcome of a completed bulk employee sync in the audit log. */
export type EmployeeSyncPreview = {
  employeeId: string;
  action: "CREATE" | "UPDATE" | "BLOCKED";
  odooId: number | null;
  message?: string;
};

/**
 * Dry run for the bulk employee sync: reports what a real run would create or
 * update, without writing to Odoo or changing any Dayflow record.
 */
export const previewEmployeeSyncChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return {
        ok: false as const,
        message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED,
        results: [] as EmployeeSyncPreview[],
      };
    }

    const { previewEmployeeSyncRecord } = await import("@/lib/odoo/sync.server");

    const ids = data.employeeIds;
    const results: EmployeeSyncPreview[] = [];
    let cursor = 0;

    await Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (cursor < ids.length) {
          const id = ids[cursor++];
          if (!id) return;
          try {
            const preview = await previewEmployeeSyncRecord(id);
            results.push({ employeeId: id, action: preview.action, odooId: preview.odooId });
          } catch (cause) {
            results.push({
              employeeId: id,
              action: "BLOCKED",
              odooId: null,
              message:
                cause instanceof OdooError
                  ? ODOO_ERROR_MESSAGES[cause.code]
                  : "This employee cannot be synchronised yet.",
            });
          }
        }
      }),
    );

    return { ok: true as const, results };
  });

export const recordBulkEmployeeSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        created: z.number().int().min(0),
        updated: z.number().int().min(0),
        failed: z.number().int().min(0),
        total: z.number().int().min(0),
        /** True when the admin stopped the run before every record was processed. */
        cancelled: z.boolean().default(false),
        /** True when nothing was written: a preview run only. */
        dryRun: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "odoo.sync_run",
      actorId: context.userId,
      actorEmail: await actorEmail(context.claims as Record<string, unknown>),
      entityType: "odoo",
      entityId: "EMPLOYEE",
      summary: data.dryRun
        ? `Bulk employee sync dry run: ${data.created} would be created, ${data.updated} would be updated, ${data.failed} blocked of ${data.total}`
        : `Bulk employee sync ${data.cancelled ? "cancelled" : "completed"}: ${data.created} created, ${data.updated} updated, ${data.failed} failed of ${data.total}`,
    });
    return { ok: true };
  });

/** Admin-only synchronisation history. Never contains credentials or tokens. */
export const listOdooSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => logFilterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("odoo_sync_logs")
      .select(
        "id, entity_type, direction, local_id, odoo_id, record_label, status, error_code, duration_ms, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.entity) query = query.eq("entity_type", data.entity);
    if (data.status) query = query.eq("status", data.status);
    if (data.onlyErrors) query = query.eq("status", "FAILED");
    if (data.from) query = query.gte("created_at", new Date(data.from).toISOString());
    if (data.to) {
      const end = new Date(data.to);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the synchronisation history.");

    // Raw provider text and stack traces stay on the server: the browser only
    // ever receives the categorised code and its plain-language explanation.
    const { ODOO_ERROR_MESSAGES } = await import("@/lib/odoo/odooRpc.server");
    const { isRetryableOdooError } = await import("@/lib/odoo/odooRpc.server");

    return (rows ?? []).map((row) => {
      const code = row.error_code as keyof typeof ODOO_ERROR_MESSAGES | null;
      return {
        ...row,
        message: code && ODOO_ERROR_MESSAGES[code] ? ODOO_ERROR_MESSAGES[code] : null,
        retryable: code ? isRetryableOdooError(code) : true,
      };
    });
  });

/** Integration state for one Dayflow employee, including the real Odoo id. */
export const getEmployeeOdooMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase
      .from("odoo_mappings")
      .select("odoo_id, sync_status, last_synced_at, last_attempt_at, error_code")
      .eq("entity_type", "EMPLOYEE")
      .eq("local_id", data.employeeId)
      .maybeSingle();

    if (error) throw new Error("We could not load the Odoo integration status.");
    return row ?? null;
  });

/** Pushes one employee to Odoo (create or update, decided by the mapping). */
export const syncEmployeeToOdoo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return { ok: false as const, message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED };
    }

    const { syncEmployeeRecord } = await import("@/lib/odoo/sync.server");
    const { recordAuditEvent } = await import("@/lib/audit.server");

    try {
      const { odooId } = await syncEmployeeRecord(data.employeeId, { userId: context.userId });
      await recordAuditEvent({
        action: "odoo.record_synced",
        actorId: context.userId,
        actorEmail: await actorEmail(context.claims as Record<string, unknown>),
        entityType: "employee",
        entityId: data.employeeId,
        summary: `Employee synchronised to Odoo (id ${odooId})`,
      });
      return { ok: true as const, odooId, message: "Employee synchronised with Odoo." };
    } catch (cause) {
      const message =
        cause instanceof OdooError
          ? ODOO_ERROR_MESSAGES[cause.code]
          : "Employee could not be synchronised.";
      return { ok: false as const, message };
    }
  });

/** Retries one failed record of any module. Non-transient failures still report honestly. */
export const retryOdooRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return { ok: false as const, message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED };
    }

    const sync = await import("@/lib/odoo/sync.server");
    const actor = { userId: context.userId };

    try {
      let odooId: number | null = null;
      if (data.entity === "EMPLOYEE")
        odooId = (await sync.syncEmployeeRecord(data.localId, actor)).odooId ?? null;
      else if (data.entity === "ATTENDANCE")
        odooId = (await sync.syncAttendanceRecord(data.localId, actor)).odooId ?? null;
      else if (data.entity === "LEAVE")
        odooId = (await sync.syncLeaveRecord(data.localId, actor)).odooId ?? null;
      else odooId = (await sync.syncPayrollRecord(data.localId, actor)).odooId ?? null;

      return {
        ok: true as const,
        odooId,
        attemptedAt: new Date().toISOString(),
        message: "Record synchronised with Odoo.",
      };
    } catch (cause) {
      const code = cause instanceof OdooError ? cause.code : null;
      const message = code
        ? ODOO_ERROR_MESSAGES[code]
        : "Synchronisation failed. Retry available.";
      return {
        ok: false as const,
        odooId: null,
        errorCode: code,
        attemptedAt: new Date().toISOString(),
        message,
      };
    }

  });

/** Runs one module's synchronisation and returns a structured result. */
export const runOdooSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entitySchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return { ok: false as const, message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED, results: [] };
    }

    const { syncEntity } = await import("@/lib/odoo/sync.server");
    const { recordAuditEvent } = await import("@/lib/audit.server");

    try {
      const result = await syncEntity(data.entity as OdooEntity, { userId: context.userId });
      await recordAuditEvent({
        action: "odoo.sync_run",
        actorId: context.userId,
        actorEmail: await actorEmail(context.claims as Record<string, unknown>),
        entityType: "odoo",
        entityId: data.entity,
        summary: `${data.entity} sync: ${result.succeeded} succeeded, ${result.failed} failed`,
      });
      const { notifyAdminsOfSyncRun } = await import("@/lib/odoo/notify.server");
      await notifyAdminsOfSyncRun([result], { scope: data.entity });
      return { ok: true as const, results: [result] as SyncRunResult[] };
    } catch (cause) {
      const message =
        cause instanceof OdooError ? ODOO_ERROR_MESSAGES[cause.code] : "Synchronisation failed.";
      const { notifyAdminsOfSyncRun } = await import("@/lib/odoo/notify.server");
      await notifyAdminsOfSyncRun([], { scope: data.entity, failureMessage: message });
      return { ok: false as const, message, results: [] as SyncRunResult[] };
    }
  });

/** Sync-all in dependency order, returning a structured per-module summary. */
export const runOdooSyncAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);

    const { odooConfigStatus, OdooError, ODOO_ERROR_MESSAGES } = await import(
      "@/lib/odoo/odooRpc.server"
    );
    if (odooConfigStatus() === "not_configured") {
      return { ok: false as const, message: ODOO_ERROR_MESSAGES.ODOO_NOT_CONFIGURED, results: [] };
    }

    const { syncAll } = await import("@/lib/odoo/sync.server");
    const { recordAuditEvent } = await import("@/lib/audit.server");

    try {
      const results = await syncAll({ userId: context.userId });
      await recordAuditEvent({
        action: "odoo.sync_run",
        actorId: context.userId,
        actorEmail: await actorEmail(context.claims as Record<string, unknown>),
        entityType: "odoo",
        entityId: "ALL",
        summary: results
          .map((item) => `${item.entity}: ${item.succeeded}/${item.succeeded + item.failed}`)
          .join(", "),
      });
      const { notifyAdminsOfSyncRun } = await import("@/lib/odoo/notify.server");
      await notifyAdminsOfSyncRun(results, { scope: "ALL" });
      return { ok: true as const, results };
    } catch (cause) {
      const message =
        cause instanceof OdooError ? ODOO_ERROR_MESSAGES[cause.code] : "Synchronisation failed.";
      const { notifyAdminsOfSyncRun } = await import("@/lib/odoo/notify.server");
      await notifyAdminsOfSyncRun([], { scope: "ALL", failureMessage: message });
      return { ok: false as const, message, results: [] as SyncRunResult[] };
    }
  });

/**
 * Admin-only read of HR data from Odoo. All credentials stay server-side; the
 * client sends only a dataset name.
 */
export const fetchOdooDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => datasetSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { odooSearchRead, OdooNotConfiguredError, odooConfigStatus } = await import(
      "@/lib/odoo/odooRpc.server"
    );

    if (odooConfigStatus() === "not_configured") {
      return { status: "not_configured" as const, rows: [] as OdooRow[] };
    }

    const target = MODEL_MAP[data.dataset];

    try {
      const rows = await odooSearchRead<OdooRow>(target.model, target.fields, [], data.limit ?? 50);

      const { recordAuditEvent } = await import("@/lib/audit.server");
      await recordAuditEvent({
        action: "odoo.fetch",
        actorId: context.userId,
        actorEmail: await actorEmail(context.claims as Record<string, unknown>),
        entityType: "odoo",
        entityId: data.dataset,
        summary: `Fetched ${rows.length} record(s) from ${target.model}`,
      });

      return { status: "connected" as const, rows };
    } catch (cause) {
      if (cause instanceof OdooNotConfiguredError) {
        return { status: "not_configured" as const, rows: [] as OdooRow[] };
      }
      console.error("[odoo] dataset fetch failed", data.dataset);
      return { status: "error" as const, rows: [] as OdooRow[] };
    }
  });
