/**
 * Odoo synchronisation service — server only.
 *
 * Direction is Dayflow → Odoo. Every write is idempotent: a stable mapping row
 * (entity_type + Dayflow id → Odoo id) decides whether a record is created or
 * updated, so repeated runs never duplicate Odoo records. A failed Odoo call
 * never rolls back Dayflow data; it is recorded as a failed mapping plus a log
 * entry that an admin can retry.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  ENTITY_MODEL,
  ODOO_MODELS,
  type OdooEntity,
  type SyncRunResult,
  type SyncRunStatus,
} from "./models";
import {
  OdooError,
  OdooNotConfiguredError,
  odooConfigStatus,
  odooCreate,
  odooFindId,
  odooModelInstalled,
  odooRecordExists,
  odooWrite,
  type OdooErrorCode,
} from "./odooRpc.server";

type Actor = { userId: string | null };

type MappingRow = {
  id: string;
  odoo_id: number | null;
  sync_status: "PENDING" | "SYNCED" | "FAILED";
};

const BATCH_LIMIT = 200;
/** Bounded concurrency keeps bulk runs fast without hammering Odoo. */
const CONCURRENCY = 4;

function toOdooDatetime(iso: string): string {
  // Odoo expects naive UTC "YYYY-MM-DD HH:MM:SS".
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

function errorCodeOf(cause: unknown): OdooErrorCode {
  return cause instanceof OdooError ? cause.code : "ODOO_UNKNOWN";
}

async function getMapping(entity: OdooEntity, localId: string): Promise<MappingRow | null> {
  const { data } = await supabaseAdmin
    .from("odoo_mappings")
    .select("id, odoo_id, sync_status")
    .eq("entity_type", entity)
    .eq("local_id", localId)
    .maybeSingle();
  return (data as MappingRow | null) ?? null;
}

async function saveMapping(
  entity: OdooEntity,
  localId: string,
  patch: {
    odooId?: number | null;
    status: "PENDING" | "SYNCED" | "FAILED";
    errorCode?: string | null;
    errorMessage?: string | null;
  },
) {
  const now = new Date().toISOString();
  await supabaseAdmin.from("odoo_mappings").upsert(
    {
      entity_type: entity,
      local_id: localId,
      ...(patch.odooId === undefined ? {} : { odoo_id: patch.odooId }),
      sync_status: patch.status,
      last_attempt_at: now,
      ...(patch.status === "SYNCED" ? { last_synced_at: now } : {}),
      error_code: patch.errorCode ?? null,
      error_message: patch.errorMessage ?? null,
    },
    { onConflict: "entity_type,local_id" },
  );
}

async function log(entry: {
  entity: OdooEntity;
  localId?: string | null;
  odooId?: number | null;
  label?: string | null;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "NOT_AVAILABLE";
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number;
  actor: Actor;
}) {
  // Structured, credential-free developer log.
  console.info("[odoo:sync]", {
    entity: entry.entity,
    localId: entry.localId ?? null,
    status: entry.status,
    errorCode: entry.errorCode ?? null,
    durationMs: entry.durationMs ?? null,
  });

  await supabaseAdmin.from("odoo_sync_logs").insert({
    entity_type: entry.entity,
    direction: "DAYFLOW_TO_ODOO",
    local_id: entry.localId ?? null,
    odoo_id: entry.odooId ?? null,
    record_label: entry.label ?? null,
    status: entry.status,
    error_code: entry.errorCode ?? null,
    error_message: entry.errorMessage ?? null,
    duration_ms: entry.durationMs ?? null,
    actor_id: entry.actor.userId,
  });
}

/** Runs tasks with bounded concurrency, collecting per-record outcomes. */
async function runBatch<T>(items: T[], task: (item: T) => Promise<"ok" | "failed" | "skipped">) {
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let cursor = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (item === undefined) return;
      const outcome = await task(item);
      if (outcome === "ok") succeeded += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;
    }
  });

  await Promise.all(workers);
  return { succeeded, failed, skipped };
}

function runStatus(succeeded: number, failed: number): SyncRunStatus {
  if (failed === 0) return "SUCCESS";
  if (succeeded === 0) return "FAILED";
  return "PARTIAL_SUCCESS";
}

/* ------------------------------------------------------------------ */
/* Employees                                                          */
/* ------------------------------------------------------------------ */

type EmployeeRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  job_position: string | null
  location: string | null;
};

/** Validates before sending; malformed payloads never reach Odoo. */
function employeePayload(row: EmployeeRow) {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  if (!name) throw new OdooError("ODOO_VALIDATION");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email ?? "")) throw new OdooError("ODOO_VALIDATION");

  const values: Record<string, unknown> = { name, work_email: row.email };
  if (row.phone) values["work_phone"] = row.phone;
  if (row.job_position) values["job_title"] = row.job_position;
  return values;
}

/**
 * Dry-run counterpart of {@link syncEmployeeRecord}: works out what a real run
 * would do without writing anything to Odoo or to the mapping table. Reads
 * only — the mapping is checked first, then the work email, exactly like the
 * live path, so the preview matches what would actually happen.
 */
export async function previewEmployeeSyncRecord(localId: string) {
  const { data: row } = await supabaseAdmin
    .from("employees")
    .select("id, first_name, last_name, email, phone, department, job_position, location")
    .eq("id", localId)
    .maybeSingle();

  if (!row) throw new OdooError("ODOO_RECORD_NOT_FOUND");
  const employee = row as EmployeeRow;

  // Validates the payload the same way the live run does, so invalid records
  // surface in the preview instead of failing halfway through an apply.
  employeePayload(employee);

  const mapping = await getMapping("EMPLOYEE", localId);
  const odooId = mapping?.odoo_id ?? null;

  if (odooId && (await odooRecordExists(ODOO_MODELS.EMPLOYEE, odooId))) {
    return { action: "UPDATE" as const, odooId, reason: "LINKED" as const };
  }

  const existing = await odooFindId(ODOO_MODELS.EMPLOYEE, "work_email", employee.email);
  if (existing) return { action: "UPDATE" as const, odooId: existing, reason: "EMAIL_MATCH" as const };

  return { action: "CREATE" as const, odooId: null, reason: "NEW" as const };
}

export async function syncEmployeeRecord(localId: string, actor: Actor) {
  const started = Date.now();
  const { data: row } = await supabaseAdmin
    .from("employees")
    .select("id, first_name, last_name, email, phone, department, job_position, location")
    .eq("id", localId)
    .maybeSingle();

  if (!row) throw new OdooError("ODOO_RECORD_NOT_FOUND");
  const employee = row as EmployeeRow;
  const label = `${employee.first_name} ${employee.last_name}`.trim();

  try {
    const values = employeePayload(employee);

    if (employee.department) {
      const departmentId = await odooFindId(ODOO_MODELS.DEPARTMENT, "name", employee.department);
      if (departmentId) values["department_id"] = departmentId;
    }

    const mapping = await getMapping("EMPLOYEE", localId);
    let odooId = mapping?.odoo_id ?? null;
    // "created" means a brand-new Odoo employee was inserted by this run.
    // Matching an existing Odoo record by work email counts as an update.
    let created = false;

    if (odooId && (await odooRecordExists(ODOO_MODELS.EMPLOYEE, odooId))) {
      await odooWrite(ODOO_MODELS.EMPLOYEE, odooId, values);
    } else {
      // Reuse an existing Odoo employee with the same work email instead of
      // creating a duplicate.
      const existing = await odooFindId(ODOO_MODELS.EMPLOYEE, "work_email", employee.email);
      if (existing) {
        odooId = existing;
      } else {
        odooId = await odooCreate(ODOO_MODELS.EMPLOYEE, values);
        created = true;
      }
      if (odooId) await odooWrite(ODOO_MODELS.EMPLOYEE, odooId, values);
    }

    await saveMapping("EMPLOYEE", localId, { odooId, status: "SYNCED" });
    await log({
      entity: "EMPLOYEE",
      localId,
      odooId,
      label,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      actor,
    });
    return { odooId, created };
  } catch (cause) {
    const code = errorCodeOf(cause);
    await saveMapping("EMPLOYEE", localId, {
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
    });
    await log({
      entity: "EMPLOYEE",
      localId,
      label,
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
      durationMs: Date.now() - started,
      actor,
    });
    throw cause;
  }
}

async function syncEmployees(actor: Actor): Promise<SyncRunResult> {
  const { data } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("status", "ACTIVE")
    .limit(BATCH_LIMIT);

  const ids = (data ?? []).map((row) => row.id);
  const result = await runBatch(ids, async (id) => {
    try {
      await syncEmployeeRecord(id, actor);
      return "ok";
    } catch {
      return "failed";
    }
  });

  return { entity: "EMPLOYEE", status: runStatus(result.succeeded, result.failed), ...result };
}

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */

async function odooEmployeeIdFor(localEmployeeId: string): Promise<number> {
  const mapping = await getMapping("EMPLOYEE", localEmployeeId);
  if (!mapping?.odoo_id) throw new OdooError("ODOO_RECORD_NOT_FOUND");
  return mapping.odoo_id;
}

export async function syncAttendanceRecord(localId: string, actor: Actor) {
  const started = Date.now();
  const { data: row } = await supabaseAdmin
    .from("attendance")
    .select("id, employee_id, attendance_date, check_in, check_out")
    .eq("id", localId)
    .maybeSingle();

  if (!row) throw new OdooError("ODOO_RECORD_NOT_FOUND");

  try {
    if (!row.check_in) throw new OdooError("ODOO_VALIDATION");

    const employeeOdooId = await odooEmployeeIdFor(row.employee_id);
    const values: Record<string, unknown> = {
      employee_id: employeeOdooId,
      check_in: toOdooDatetime(row.check_in),
      ...(row.check_out ? { check_out: toOdooDatetime(row.check_out) } : {}),
    };

    const mapping = await getMapping("ATTENDANCE", localId);
    let odooId = mapping?.odoo_id ?? null;

    if (odooId && (await odooRecordExists(ODOO_MODELS.ATTENDANCE, odooId))) {
      await odooWrite(ODOO_MODELS.ATTENDANCE, odooId, values);
    } else {
      odooId = await odooCreate(ODOO_MODELS.ATTENDANCE, values);
    }

    await saveMapping("ATTENDANCE", localId, { odooId, status: "SYNCED" });
    await log({
      entity: "ATTENDANCE",
      localId,
      odooId,
      label: row.attendance_date,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      actor,
    });
    return { odooId };
  } catch (cause) {
    const code = errorCodeOf(cause);
    await saveMapping("ATTENDANCE", localId, {
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
    });
    await log({
      entity: "ATTENDANCE",
      localId,
      label: row.attendance_date,
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
      durationMs: Date.now() - started,
      actor,
    });
    throw cause;
  }
}

async function syncAttendance(actor: Actor): Promise<SyncRunResult> {
  const { data } = await supabaseAdmin
    .from("attendance")
    .select("id")
    .not("check_in", "is", null)
    .order("attendance_date", { ascending: false })
    .limit(BATCH_LIMIT);

  const ids = (data ?? []).map((row) => row.id);
  const result = await runBatch(ids, async (id) => {
    try {
      await syncAttendanceRecord(id, actor);
      return "ok";
    } catch {
      return "failed";
    }
  });

  return { entity: "ATTENDANCE", status: runStatus(result.succeeded, result.failed), ...result };
}

/* ------------------------------------------------------------------ */
/* Leave                                                              */
/* ------------------------------------------------------------------ */

export async function syncLeaveRecord(localId: string, actor: Actor) {
  const started = Date.now();
  const { data: row } = await supabaseAdmin
    .from("leave_requests")
    .select("id, employee_id, start_date, end_date, status, remarks, leave_types!inner(name)")
    .eq("id", localId)
    .maybeSingle();

  if (!row) throw new OdooError("ODOO_RECORD_NOT_FOUND");
  const typeName = (row as unknown as { leave_types: { name: string } }).leave_types.name;

  try {
    // Only approved leave becomes an Odoo leave record; rejected/cancelled
    // requests are never pushed as approved time off.
    if (row.status !== "APPROVED") {
      await log({
        entity: "LEAVE",
        localId,
        label: typeName,
        status: "SKIPPED",
        durationMs: Date.now() - started,
        actor,
      });
      return { odooId: null, skipped: true };
    }

    const employeeOdooId = await odooEmployeeIdFor(row.employee_id);
    const leaveTypeId = await odooFindId(ODOO_MODELS.LEAVE_TYPE, "name", typeName);
    if (!leaveTypeId) throw new OdooError("ODOO_RECORD_NOT_FOUND");

    const values: Record<string, unknown> = {
      employee_id: employeeOdooId,
      holiday_status_id: leaveTypeId,
      request_date_from: row.start_date,
      request_date_to: row.end_date,
      ...(row.remarks ? { name: row.remarks } : {}),
    };

    const mapping = await getMapping("LEAVE", localId);
    let odooId = mapping?.odoo_id ?? null;

    if (odooId && (await odooRecordExists(ODOO_MODELS.LEAVE, odooId))) {
      await odooWrite(ODOO_MODELS.LEAVE, odooId, values);
    } else {
      odooId = await odooCreate(ODOO_MODELS.LEAVE, values);
    }

    await saveMapping("LEAVE", localId, { odooId, status: "SYNCED" });
    await log({
      entity: "LEAVE",
      localId,
      odooId,
      label: typeName,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      actor,
    });
    return { odooId };
  } catch (cause) {
    const code = errorCodeOf(cause);
    await saveMapping("LEAVE", localId, {
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
    });
    await log({
      entity: "LEAVE",
      localId,
      label: typeName,
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
      durationMs: Date.now() - started,
      actor,
    });
    throw cause;
  }
}

async function syncLeave(actor: Actor): Promise<SyncRunResult> {
  const { data } = await supabaseAdmin
    .from("leave_requests")
    .select("id")
    .eq("status", "APPROVED")
    .order("start_date", { ascending: false })
    .limit(BATCH_LIMIT);

  const ids = (data ?? []).map((row) => row.id);
  const result = await runBatch(ids, async (id) => {
    try {
      await syncLeaveRecord(id, actor);
      return "ok";
    } catch {
      return "failed";
    }
  });

  return { entity: "LEAVE", status: runStatus(result.succeeded, result.failed), ...result };
}

/* ------------------------------------------------------------------ */
/* Payroll                                                            */
/* ------------------------------------------------------------------ */

/** Payroll exists only in Odoo editions that ship hr.payslip. */
export async function payrollSupported(): Promise<boolean> {
  if (odooConfigStatus() === "not_configured") return false;
  try {
    return await odooModelInstalled(ODOO_MODELS.PAYROLL);
  } catch {
    return false;
  }
}

const PAYROLL_UNAVAILABLE =
  "Payroll synchronisation is unavailable in the configured Odoo environment.";

export async function syncPayrollRecord(localId: string, actor: Actor) {
  const started = Date.now();

  if (!(await payrollSupported())) {
    await log({
      entity: "PAYROLL",
      localId,
      status: "NOT_AVAILABLE",
      errorCode: "ODOO_MODEL_MISSING",
      errorMessage: PAYROLL_UNAVAILABLE,
      durationMs: Date.now() - started,
      actor,
    });
    throw new OdooError("ODOO_MODEL_MISSING");
  }

  const { data: row } = await supabaseAdmin
    .from("payroll_records")
    .select("id, employee_id, period_start, period_end, status")
    .eq("id", localId)
    .maybeSingle();

  if (!row) throw new OdooError("ODOO_RECORD_NOT_FOUND");

  try {
    // Only finalised payroll is pushed.
    if (row.status !== "PROCESSED" && row.status !== "PAID") {
      await log({
        entity: "PAYROLL",
        localId,
        status: "SKIPPED",
        durationMs: Date.now() - started,
        actor,
      });
      return { odooId: null, skipped: true };
    }

    const employeeOdooId = await odooEmployeeIdFor(row.employee_id);
    const values: Record<string, unknown> = {
      employee_id: employeeOdooId,
      date_from: row.period_start,
      date_to: row.period_end,
    };

    const mapping = await getMapping("PAYROLL", localId);
    let odooId = mapping?.odoo_id ?? null;

    if (odooId && (await odooRecordExists(ODOO_MODELS.PAYROLL, odooId))) {
      await odooWrite(ODOO_MODELS.PAYROLL, odooId, values);
    } else {
      odooId = await odooCreate(ODOO_MODELS.PAYROLL, values);
    }

    await saveMapping("PAYROLL", localId, { odooId, status: "SYNCED" });
    await log({
      entity: "PAYROLL",
      localId,
      odooId,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      actor,
    });
    return { odooId };
  } catch (cause) {
    const code = errorCodeOf(cause);
    await saveMapping("PAYROLL", localId, {
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
    });
    await log({
      entity: "PAYROLL",
      localId,
      status: "FAILED",
      errorCode: code,
      errorMessage: cause instanceof Error ? cause.message : null,
      durationMs: Date.now() - started,
      actor,
    });
    throw cause;
  }
}

async function syncPayroll(actor: Actor): Promise<SyncRunResult> {
  if (!(await payrollSupported())) {
    return {
      entity: "PAYROLL",
      status: "NOT_AVAILABLE",
      succeeded: 0,
      failed: 0,
      skipped: 0,
      message: PAYROLL_UNAVAILABLE,
    };
  }

  const { data } = await supabaseAdmin
    .from("payroll_records")
    .select("id")
    .in("status", ["PROCESSED", "PAID"])
    .limit(BATCH_LIMIT);

  const ids = (data ?? []).map((row) => row.id);
  const result = await runBatch(ids, async (id) => {
    try {
      await syncPayrollRecord(id, actor);
      return "ok";
    } catch {
      return "failed";
    }
  });

  return { entity: "PAYROLL", status: runStatus(result.succeeded, result.failed), ...result };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                      */
/* ------------------------------------------------------------------ */

export async function syncEntity(entity: OdooEntity, actor: Actor): Promise<SyncRunResult> {
  if (odooConfigStatus() === "not_configured") throw new OdooNotConfiguredError();

  switch (entity) {
    case "EMPLOYEE":
      return syncEmployees(actor);
    case "ATTENDANCE":
      return syncAttendance(actor);
    case "LEAVE":
      return syncLeave(actor);
    case "PAYROLL":
      return syncPayroll(actor);
  }
}

/**
 * Sync-all in dependency order. Attendance, leave and payroll all depend on
 * employee mappings, so the run stops early if no employee synchronised.
 */
export async function syncAll(actor: Actor): Promise<SyncRunResult[]> {
  if (odooConfigStatus() === "not_configured") throw new OdooNotConfiguredError();

  const results: SyncRunResult[] = [];
  const employees = await syncEmployees(actor);
  results.push(employees);

  if (employees.status === "FAILED" && employees.failed > 0) {
    for (const entity of ["ATTENDANCE", "LEAVE", "PAYROLL"] as const) {
      results.push({
        entity,
        status: "FAILED",
        succeeded: 0,
        failed: 0,
        skipped: 0,
        message: "Skipped because employee synchronisation failed.",
      });
    }
    return results;
  }

  results.push(await syncAttendance(actor));
  results.push(await syncLeave(actor));
  results.push(await syncPayroll(actor));
  return results;
}

export { ENTITY_MODEL, PAYROLL_UNAVAILABLE };
