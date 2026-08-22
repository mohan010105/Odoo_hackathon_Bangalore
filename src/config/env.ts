/**
 * Environment configuration boundary.
 *
 * Browser-safe values only. Odoo credentials (ODOO_BASE_URL, ODOO_DATABASE,
 * ODOO_API_KEY, ODOO_USERNAME) are SERVER-ONLY and must be read inside server
 * handlers via process.env — never imported into client code and never exposed
 * through VITE_* variables.
 */

export const clientEnv = {
  /** Base URL of the Dayflow integration/backend layer the frontend talks to. */
  apiBaseUrl: import.meta.env["VITE_API_BASE_URL"] ?? "/api",
  appName: "Dayflow",
  appTagline: "Every workday, perfectly aligned.",
} as const;

/** Names of the server-side Odoo variables required in a later phase. */
export const REQUIRED_ODOO_SERVER_ENV = [
  "ODOO_BASE_URL",
  "ODOO_DATABASE",
  "ODOO_API_KEY",
  "ODOO_USERNAME",
] as const;
