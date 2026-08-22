import { fetchOdooDataset, getOdooStatus, type OdooDataset } from "@/lib/odoo.functions";

/**
 * Odoo integration boundary.
 *
 * The browser NEVER talks to Odoo directly and never holds Odoo credentials.
 * Calls are proxied through admin-only Dayflow server functions, which read
 * ODOO_BASE_URL / ODOO_DATABASE / ODOO_API_KEY / ODOO_USERNAME server-side.
 */

export type OdooConnectionStatus = "not_configured" | "connected" | "error";

export const odooClient = {
  /** Honest status for the UI — reported by the server, never from client config. */
  async getConnectionStatus(): Promise<OdooConnectionStatus> {
    try {
      const { status } = await getOdooStatus({});
      return status === "configured" ? "connected" : "not_configured";
    } catch {
      return "error";
    }
  },

  /** Read-only Odoo fetch, proxied through the Dayflow server layer. */
  async fetch(dataset: OdooDataset, limit?: number) {
    return fetchOdooDataset({ data: { dataset, ...(limit ? { limit } : {}) } });
  },
};
