/**
 * Client-side retry bookkeeping for the Odoo sync activity log. Attempts are
 * kept per log entry so admins can see when a record was re-run, which Odoo
 * request/record id answered, and how it ended.
 */

export type RetryAttempt = {
  attemptedAt: string;
  outcome: "SUCCESS" | "FAILED";
  /** Odoo record/request id returned by the retry, when one was issued. */
  odooId: number | null;
  message: string;
  errorCode: string | null;
};

export type RetryHistory = Record<string, RetryAttempt[]>;

export function appendAttempt(
  history: RetryHistory,
  logId: string,
  attempt: RetryAttempt,
): RetryHistory {
  return { ...history, [logId]: [...(history[logId] ?? []), attempt] };
}

export function lastAttempt(history: RetryHistory, logId: string): RetryAttempt | undefined {
  const attempts = history[logId];
  return attempts?.[attempts.length - 1];
}

/** Short summary of the most recent retry, used in the table and CSV export. */
export function lastAttemptSummary(attempt: RetryAttempt | undefined): string {
  if (!attempt) return "No retry attempted";
  const stamp = new Date(attempt.attemptedAt).toISOString();
  const suffix = attempt.odooId ? ` (Odoo id ${attempt.odooId})` : "";
  return `${attempt.outcome === "SUCCESS" ? "Re-synced" : "Still failing"} at ${stamp}${suffix}`;
}

/** Recommended next steps per categorised error code — safe, actionable guidance. */
export function recommendedSteps(errorCode: string | null): string[] {
  switch (errorCode) {
    case "ODOO_NOT_CONFIGURED":
      return [
        "Add the Odoo connection settings for this workspace.",
        "Run the connection test on this page before retrying.",
      ];
    case "ODOO_AUTH_FAILED":
      return [
        "Confirm the integration user's credentials are still valid in Odoo.",
        "Check the integration user has not been archived or had access revoked.",
        "Re-run the connection test, then retry this record.",
      ];
    case "ODOO_UNREACHABLE":
    case "ODOO_TIMEOUT":
      return [
        "Verify the Odoo instance is online and reachable.",
        "Wait a moment — this is usually transient — then retry.",
      ];
    case "ODOO_MODEL_MISSING":
      return [
        "Install or enable the matching Odoo app for this module.",
        "Records stay queued locally and will sync once the model exists.",
      ];
    case "ODOO_VALIDATION_FAILED":
      return [
        "Review the local record for missing or invalid required fields.",
        "Fix the data in Dayflow, then retry — the existing link is reused.",
      ];
    default:
      return [
        "Retry the record — retries are idempotent and update rather than duplicate.",
        "If it keeps failing, check the record's data and the Odoo connection test.",
      ];
  }
}
