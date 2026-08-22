import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditAction =
  | "employee.created"
  | "employee.verification_resent"
  | "profile.updated"
  | "password.changed"
  | "password.reset_requested"
  | "auth.login"
  | "auth.login_failed"
  | "auth.login_blocked_unverified"
  | "company.updated"
  | "attendance.corrected"
  | "leave.reviewed"
  | "leave.allocation_changed"
  | "leave.type_changed"
  | "attendance.exported"
  | "payroll.previewed"
  | "payroll.generated"
  | "payroll.exported"
  | "payroll.payslips_downloaded"
  | "payroll.status_changed"
  | "salary.structure_changed"
  | "salary.component_changed"
  | "odoo.fetch"
  | "odoo.connection_tested"
  | "odoo.sync_run"
  | "odoo.record_synced"
  | "audit.exported"
  | "org.department_changed"
  | "org.department_removed"
  | "org.position_changed"
  | "org.position_removed"
  | "employee.private_info_changed";

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
};

/**
 * Appends an entry to the admin-only activity log.
 *
 * Only non-sensitive descriptors are stored: never passwords, tokens, or any
 * other credential material. Logging failures must never break the action that
 * was being audited, so errors are swallowed after being reported to the server
 * console.
 */
export async function recordAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? null,
    });
  } catch (cause) {
    console.error("[audit] could not record event", entry.action, cause);
  }
}

/** Masks an email for log summaries, e.g. "jane.doe@acme.com" → "j***e@acme.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "hidden";
  const visible = local.length <= 2 ? local[0] : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domain}`;
}
