/**
 * Central Odoo model mapping and integration vocabulary.
 *
 * Odoo model names live here only, so no component or service hardcodes them.
 * This module is client-safe: it contains no credentials and no network code.
 */

export const ODOO_ENTITIES = ["EMPLOYEE", "ATTENDANCE", "LEAVE", "PAYROLL"] as const;
export type OdooEntity = (typeof ODOO_ENTITIES)[number];

export const ODOO_MODELS = {
  EMPLOYEE: "hr.employee",
  ATTENDANCE: "hr.attendance",
  LEAVE: "hr.leave",
  LEAVE_TYPE: "hr.leave.type",
  DEPARTMENT: "hr.department",
  PAYROLL: "hr.payslip",
} as const;

export const ENTITY_MODEL: Record<OdooEntity, string> = {
  EMPLOYEE: ODOO_MODELS.EMPLOYEE,
  ATTENDANCE: ODOO_MODELS.ATTENDANCE,
  LEAVE: ODOO_MODELS.LEAVE,
  PAYROLL: ODOO_MODELS.PAYROLL,
};

export const ENTITY_LABELS: Record<OdooEntity, string> = {
  EMPLOYEE: "Employees",
  ATTENDANCE: "Attendance",
  LEAVE: "Leave",
  PAYROLL: "Payroll",
};

/** Connection state reported by the server. Never inferred in the browser. */
export type OdooConnectionState = "CONNECTED" | "DISCONNECTED" | "NOT_CONFIGURED" | "ERROR";

/** Per-record integration state stored in odoo_mappings. */
export type SyncRecordStatus = "PENDING" | "SYNCED" | "FAILED" | "NOT_SYNCED";

/** Outcome of a batch synchronisation run. */
export type SyncRunStatus = "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "NOT_AVAILABLE";

export type SyncRunResult = {
  entity: OdooEntity;
  status: SyncRunStatus;
  succeeded: number;
  failed: number;
  skipped: number;
  /** User-facing note, e.g. why an entity is unavailable. Never raw Odoo output. */
  message?: string;
};

export const SYNC_STATUS_LABELS: Record<SyncRecordStatus, string> = {
  SYNCED: "Synced",
  PENDING: "Pending",
  FAILED: "Failed",
  NOT_SYNCED: "Not synced",
};

export const CONNECTION_LABELS: Record<OdooConnectionState, string> = {
  CONNECTED: "Connected",
  DISCONNECTED: "Disconnected",
  NOT_CONFIGURED: "Not configured",
  ERROR: "Error",
};

/** Messages shown to admins. Raw provider errors are never surfaced. */
export const CONNECTION_MESSAGES: Record<OdooConnectionState, string> = {
  CONNECTED: "Odoo connection successful.",
  DISCONNECTED: "Unable to connect to Odoo.",
  NOT_CONFIGURED: "Odoo credentials are not configured.",
  ERROR: "Unable to connect to Odoo.",
};
