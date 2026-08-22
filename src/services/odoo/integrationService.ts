import {
  getEmployeeOdooMapping,
  getOdooOverview,
  listEmployeeSyncCandidates,
  listOdooSyncLogs,
  previewEmployeeSyncChunk,
  recordBulkEmployeeSync,
  retryOdooRecord,
  runOdooSync,
  runOdooSyncAll,
  syncEmployeeChunkToOdoo,
  syncEmployeeToOdoo,
  testOdooConnection,
  type EmployeeSyncOutcome,
  type EmployeeSyncPreview,
} from "@/lib/odoo.functions";
import type { OdooConnectionState, OdooEntity, SyncRunResult } from "@/lib/odoo/models";

export type OdooOverview = {
  configured: boolean;
  payrollAvailable: boolean | null;
  stats: { entity: OdooEntity; synced: number; failed: number; pending: number }[];
  lastSuccessfulSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  errorCount: number;
};

export type OdooSyncLog = {
  id: string;
  entity_type: OdooEntity;
  direction: string;
  local_id: string | null;
  odoo_id: number | null;
  record_label: string | null;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "NOT_AVAILABLE";
  error_code: string | null;
  duration_ms: number | null;
  created_at: string;
  /** Plain-language explanation derived server-side from the error category. */
  message: string | null;
  retryable: boolean;
};

export type EmployeeSyncCandidate = {
  id: string;
  loginId: string;
  name: string;
  status: string;
  odooId: number | null;
  syncStatus: "SYNCED" | "PENDING" | "FAILED" | "NOT_SYNCED";
  lastSyncedAt: string | null;
};

export type ConnectionTestResult = {
  state: OdooConnectionState;
  message: string;
  checkedAt: string;
};

export type { EmployeeSyncOutcome, EmployeeSyncPreview };

export type SyncLogFilters = {
  entity?: OdooEntity;
  status?: "SUCCESS" | "FAILED" | "SKIPPED" | "NOT_AVAILABLE";
  from?: string;
  to?: string;
  onlyErrors?: boolean;
  limit?: number;
};

/**
 * Odoo integration boundary for admin screens. Every call is an admin-gated
 * server function: the browser never holds Odoo credentials, and failures
 * arrive as safe categorised messages rather than raw provider output.
 */
export const odooIntegrationService = {
  async testConnection(): Promise<ConnectionTestResult> {
    return (await testOdooConnection({})) as ConnectionTestResult;
  },

  async overview(): Promise<OdooOverview> {
    return (await getOdooOverview({})) as OdooOverview;
  },

  async logs(filters: SyncLogFilters = {}): Promise<OdooSyncLog[]> {
    return (await listOdooSyncLogs({ data: filters })) as unknown as OdooSyncLog[];
  },

  async employeeCandidates(
    filters: { includeInactive?: boolean; onlyFailedOrMissing?: boolean } = {},
  ): Promise<EmployeeSyncCandidate[]> {
    return (await listEmployeeSyncCandidates({
      data: filters,
    })) as unknown as EmployeeSyncCandidate[];
  },

  /** One chunk of a bulk employee sync; the caller drives progress. */
  async syncEmployeeChunk(employeeIds: string[]) {
    return syncEmployeeChunkToOdoo({ data: { employeeIds } }) as Promise<{
      ok: boolean;
      message?: string;
      results: EmployeeSyncOutcome[];
    }>;
  },

  /** Dry run for one chunk: reports intended creates/updates, writes nothing. */
  async previewEmployeeChunk(employeeIds: string[]) {
    return previewEmployeeSyncChunk({ data: { employeeIds } }) as Promise<{
      ok: boolean;
      message?: string;
      results: EmployeeSyncPreview[];
    }>;
  },

  async logBulkEmployeeSync(summary: {
    created: number;
    updated: number;
    failed: number;
    total: number;
    cancelled?: boolean;
    dryRun?: boolean;
  }) {
    await recordBulkEmployeeSync({
      data: {
        ...summary,
        cancelled: summary.cancelled ?? false,
        dryRun: summary.dryRun ?? false,
      },
    });
  },

  async syncEmployee(employeeId: string) {
    return syncEmployeeToOdoo({ data: { employeeId } });
  },

  async mappingFor(employeeId: string) {
    return getEmployeeOdooMapping({ data: { employeeId } });
  },

  async retryRecord(entity: OdooEntity, localId: string) {
    return retryOdooRecord({ data: { entity, localId } });
  },

  async runEntitySync(entity: OdooEntity) {
    return runOdooSync({ data: { entity } }) as Promise<{
      ok: boolean;
      message?: string;
      results: SyncRunResult[];
    }>;
  },

  async runFullSync() {
    return runOdooSyncAll({}) as Promise<{
      ok: boolean;
      message?: string;
      results: SyncRunResult[];
    }>;
  },
};
