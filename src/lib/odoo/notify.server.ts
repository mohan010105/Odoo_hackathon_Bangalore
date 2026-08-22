import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { SyncRunResult } from "./models";

export type SyncOutcome = "SUCCESS" | "PARTIAL" | "FAILED";

/** Aggregates per-module results into a single run outcome. */
export function syncOutcome(results: SyncRunResult[]): SyncOutcome {
  const succeeded = results.reduce((sum, item) => sum + item.succeeded, 0);
  const failed = results.reduce((sum, item) => sum + item.failed, 0);
  if (failed === 0) return "SUCCESS";
  if (succeeded === 0) return "FAILED";
  return "PARTIAL";
}

const TITLES: Record<SyncOutcome, string> = {
  SUCCESS: "Odoo synchronisation completed",
  PARTIAL: "Odoo synchronisation completed with failures",
  FAILED: "Odoo synchronisation failed",
};

const BODIES: Record<SyncOutcome, string> = {
  SUCCESS: "Odoo synchronisation completed successfully.",
  PARTIAL: "Odoo synchronisation completed with some failures.",
  FAILED: "Odoo synchronisation failed.",
};

/**
 * Notifies every admin about the result of a sync run.
 *
 * Only counts and module names are stored — never Odoo URLs, credentials or
 * raw API errors. A run started within the same minute as an identical
 * notification is skipped, so a double-clicked "Sync now" cannot spam the bell.
 */
export async function notifyAdminsOfSyncRun(
  results: SyncRunResult[],
  options: { scope: string; failureMessage?: string } = { scope: "ALL" },
): Promise<void> {
  try {
    const outcome = results.length === 0 ? "FAILED" : syncOutcome(results);
    const processed = results.reduce((sum, item) => sum + item.succeeded + item.failed, 0);
    const failed = results.reduce((sum, item) => sum + item.failed, 0);

    const detail =
      results.length === 0
        ? (options.failureMessage ?? "The connected Odoo environment could not be reached.")
        : `${processed} record${processed === 1 ? "" : "s"} processed, ${failed} failed (${options.scope.toLowerCase()}).`;

    const { data: admins, error: adminError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "ADMIN");

    if (adminError || !admins || admins.length === 0) return;

    const title = TITLES[outcome];
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("notifications")
      .select("user_id")
      .eq("title", title)
      .eq("category", "INTEGRATION")
      .gte("created_at", since);

    const alreadyNotified = new Set((recent ?? []).map((row) => row.user_id));
    const rows = admins
      .filter((admin) => !alreadyNotified.has(admin.user_id))
      .map((admin) => ({
        user_id: admin.user_id,
        title,
        body: `${BODIES[outcome]} ${detail}`,
        category: "INTEGRATION",
        link: "/admin/integrations",
      }));

    if (rows.length === 0) return;
    await supabaseAdmin.from("notifications").insert(rows);
  } catch (cause) {
    console.error("[odoo] could not notify admins about sync run", cause);
  }
}
