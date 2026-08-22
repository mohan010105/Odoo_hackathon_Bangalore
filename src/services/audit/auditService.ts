import { listAuditLogs, recordAuditExport } from "@/lib/audit.functions";

export type AuditLogEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
};

export const AUDIT_ACTIONS = [
  "employee.created",
  "employee.verification_resent",
  "profile.updated",
  "password.changed",
  "password.reset_requested",
  "auth.login",
  "auth.login_failed",
  "auth.login_blocked_unverified",
  "company.updated",
  "attendance.corrected",
  "attendance.exported",
  "leave.reviewed",
  "leave.allocation_changed",
  "leave.type_changed",
  "payroll.previewed",
  "payroll.generated",
  "payroll.exported",
  "payroll.payslips_downloaded",
  "payroll.status_changed",
  "salary.structure_changed",
  "salary.component_changed",
  "odoo.fetch",
  "odoo.connection_tested",
  "odoo.sync_run",
  "odoo.record_synced",
  "audit.exported",
  "org.department_changed",
  "org.department_removed",
  "org.position_changed",
  "org.position_removed",
  "employee.private_info_changed",
] as const;

/**
 * Actions that change money, entitlements, credentials or attendance facts.
 * These are the events an auditor cares about, so the log can be narrowed to
 * exactly this set.
 */
export const SENSITIVE_AUDIT_ACTIONS = [
  "leave.reviewed",
  "leave.allocation_changed",
  "leave.type_changed",
  "attendance.corrected",
  "password.changed",
  "password.reset_requested",
  "payroll.previewed",
  "payroll.generated",
  "payroll.exported",
  "payroll.payslips_downloaded",
  "payroll.status_changed",
  "salary.structure_changed",
  "salary.component_changed",
  "employee.created",
  "odoo.sync_run",
  "odoo.record_synced",
  "employee.private_info_changed",
] as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "employee.created": "Employee provisioned",
  "employee.verification_resent": "Verification email resent",
  "profile.updated": "Profile updated",
  "password.changed": "Password changed",
  "password.reset_requested": "Password reset requested",
  "auth.login": "Sign in",
  "auth.login_failed": "Failed sign in",
  "auth.login_blocked_unverified": "Sign in blocked (unverified)",
  "company.updated": "Company settings updated",
  "attendance.corrected": "Attendance corrected",
  "attendance.exported": "Attendance exported",
  "leave.reviewed": "Leave approved or rejected",
  "leave.allocation_changed": "Leave allocation changed",
  "leave.type_changed": "Leave policy changed",
  "payroll.previewed": "Payroll previewed",
  "payroll.exported": "Payroll exported",
  "payroll.payslips_downloaded": "Payslips downloaded",
  "payroll.generated": "Payroll generated",
  "payroll.status_changed": "Payroll status changed",
  "salary.structure_changed": "Salary structure changed",
  "salary.component_changed": "Salary component changed",
  "odoo.fetch": "Odoo data read",
  "odoo.connection_tested": "Odoo connection tested",
  "odoo.sync_run": "Odoo sync run",
  "odoo.record_synced": "Record synced to Odoo",
  "audit.exported": "Activity log exported",
  "org.department_changed": "Department changed",
  "org.department_removed": "Department removed",
  "org.position_changed": "Job position changed",
  "org.position_removed": "Job position removed",
  "employee.private_info_changed": "Employee private info changed",
};


export type AuditSortField = "created_at" | "action" | "actor_email" | "entity_id";

export type AuditLogFilters = {
  search?: string;
  action?: string;
  actionPrefix?: string;
  actions?: readonly string[];
  actorEmail?: string;
  entityType?: string;
  entityId?: string;
  summaryContains?: string;
  from?: string;
  to?: string;
  sortBy?: AuditSortField;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

function toPayload(filters: AuditLogFilters) {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actionPrefix ? { actionPrefix: filters.actionPrefix } : {}),
    ...(filters.actions && filters.actions.length > 0 ? { actions: [...filters.actions] } : {}),
    ...(filters.actorEmail ? { actorEmail: filters.actorEmail } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.summaryContains ? { summaryContains: filters.summaryContains } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    sortBy: filters.sortBy ?? ("created_at" as AuditSortField),
    sortDir: filters.sortDir ?? ("desc" as const),
    limit: filters.limit ?? 25,
    offset: filters.offset ?? 0,
  };
}

export const auditService = {
  /** One sorted, filtered page of the activity log plus the matching total. */
  async list(filters: AuditLogFilters = {}): Promise<{ rows: AuditLogEntry[]; total: number }> {
    const result = await listAuditLogs({ data: toPayload(filters) });

    return {
      total: result.total,
      rows: result.rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorEmail: row.actor_email ?? null,
        entityType: row.entity_type ?? null,
        entityId: row.entity_id ?? null,
        summary: row.summary ?? null,
        createdAt: row.created_at,
      })),
    };
  },

  /** Every matching entry for a CSV export, bounded to keep the file sane. */
  async listForExport(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    const { rows } = await this.list({ ...filters, limit: 200, offset: 0 });
    return rows;
  },

  /** Idempotent: repeated clicks on the same export record one entry only. */
  async logExport(input: { idempotencyKey: string; recordCount: number; scope?: string }) {
    return recordAuditExport({
      data: {
        idempotencyKey: input.idempotencyKey,
        recordCount: input.recordCount,
        scope: input.scope ?? "filtered",
      },
    });
  },
};
