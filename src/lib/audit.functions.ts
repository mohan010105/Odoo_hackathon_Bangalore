import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";

const filterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  action: z.string().trim().max(60).optional(),
  actionPrefix: z.string().trim().max(40).optional(),
  /** Exact actor email, for "everything this administrator did". */
  actorEmail: z.string().trim().max(160).optional(),
  /** Record scope, e.g. payroll_period / employee / leave_request. */
  entityType: z.string().trim().max(40).optional(),
  /** Record key, e.g. a payroll period label such as 2026-03. */
  entityId: z.string().trim().max(80).optional(),
  /** Free-text match against the human summary, used for status filters. */
  summaryContains: z.string().trim().max(80).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  /** Restrict to an explicit set of actions, e.g. the sensitive-only view. */
  actions: z.array(z.string().trim().max(60)).max(60).optional(),
  sortBy: z.enum(["created_at", "action", "actor_email", "entity_id"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(200).default(25),
  offset: z.number().int().min(0).max(5000).default(0),
});


/** Admin-only activity log. RLS also restricts this table to administrators. */
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("audit_logs")
      .select("id, action, actor_email, entity_type, entity_id, summary, created_at", {
        count: "exact",
      })
      .order(data.sortBy, { ascending: data.sortDir === "asc", nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.actions && data.actions.length > 0) query = query.in("action", data.actions);

    if (data.action) query = query.eq("action", data.action);
    if (data.actorEmail) query = query.ilike("actor_email", data.actorEmail);
    if (data.entityType) query = query.eq("entity_type", data.entityType);
    if (data.entityId) query = query.eq("entity_id", data.entityId);
    if (data.summaryContains) query = query.ilike("summary", `%${data.summaryContains}%`);
    if (data.from) query = query.gte("created_at", new Date(data.from).toISOString());
    if (data.to) {
      const end = new Date(data.to);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }
    if (data.actionPrefix) query = query.like("action", `${data.actionPrefix}%`);
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(`actor_email.ilike.${term},summary.ilike.${term},action.ilike.${term}`);
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error("We could not load the activity log.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/**
 * Records an activity-log CSV export. The export is claimed by idempotency key
 * first, so duplicate clicks and retries produce exactly one export entry.
 */
export const recordAuditExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        idempotencyKey: z.string().trim().min(8).max(120),
        recordCount: z.number().int().min(0).max(100000),
        scope: z.string().trim().max(120).default("filtered"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: claimed, error: claimError } = await context.supabase.rpc("export_job_claim", {
      _kind: "AUDIT_CSV",
      _entity_label: data.scope,
      _idempotency_key: data.idempotencyKey,
      _record_count: data.recordCount,
    });
    if (claimError) throw new Error("We could not record this export.");
    if (claimed !== true) return { ok: true, duplicate: true };

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "audit.exported",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "audit_log",
      entityId: data.scope,
      summary: `Exported ${data.recordCount} activity log entr${
        data.recordCount === 1 ? "y" : "ies"
      } as CSV (${data.scope})`,
    });

    return { ok: true, duplicate: false };
  });
