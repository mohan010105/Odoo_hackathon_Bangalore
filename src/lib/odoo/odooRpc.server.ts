/**
 * Odoo JSON-RPC boundary — server only.
 *
 * Odoo credentials live exclusively in server environment variables and are
 * never returned to the browser, logged, or embedded in responses. The client
 * only ever sees mapped HR data, a status, or a categorised error code.
 */

import { ODOO_MODELS } from "./models";

export type OdooConfigStatus = "not_configured" | "configured";

const REQUEST_TIMEOUT_MS = 15_000;

type OdooConfig = {
  baseUrl: string;
  database: string;
  username: string;
  apiKey: string;
};

/** Categories the UI can reason about without seeing provider internals. */
export type OdooErrorCode =
  | "ODOO_NOT_CONFIGURED"
  | "ODOO_TIMEOUT"
  | "ODOO_UNAVAILABLE"
  | "ODOO_AUTH_FAILED"
  | "ODOO_PERMISSION_DENIED"
  | "ODOO_MODEL_MISSING"
  | "ODOO_RECORD_NOT_FOUND"
  | "ODOO_VALIDATION"
  | "ODOO_RATE_LIMITED"
  | "ODOO_SERVER_ERROR"
  | "ODOO_MALFORMED_RESPONSE"
  | "ODOO_UNKNOWN";

/** Only transient categories may be retried automatically. */
const RETRYABLE: ReadonlySet<OdooErrorCode> = new Set<OdooErrorCode>([
  "ODOO_TIMEOUT",
  "ODOO_UNAVAILABLE",
  "ODOO_RATE_LIMITED",
  "ODOO_SERVER_ERROR",
]);

/** Whether a failure category is worth retrying automatically. */
export function isRetryableOdooError(code: OdooErrorCode): boolean {
  return RETRYABLE.has(code);
}

export const ODOO_ERROR_MESSAGES: Record<OdooErrorCode, string> = {
  ODOO_NOT_CONFIGURED: "Odoo credentials are not configured.",
  ODOO_TIMEOUT:
    "Odoo did not respond. Your Dayflow data has been saved and synchronisation can be retried.",
  ODOO_UNAVAILABLE: "Odoo is currently unavailable.",
  ODOO_AUTH_FAILED: "Unable to authenticate with Odoo.",
  ODOO_PERMISSION_DENIED: "The Odoo account is not permitted to perform this operation.",
  ODOO_MODEL_MISSING: "This module is not available in the configured Odoo environment.",
  ODOO_RECORD_NOT_FOUND: "The matching Odoo record could not be found.",
  ODOO_VALIDATION: "Odoo rejected the record because required information is missing or invalid.",
  ODOO_RATE_LIMITED: "Odoo is rate limiting requests. Retry shortly.",
  ODOO_SERVER_ERROR: "Odoo reported a server error.",
  ODOO_MALFORMED_RESPONSE: "Odoo returned an unexpected response.",
  ODOO_UNKNOWN: "Synchronisation with Odoo failed.",
};

export class OdooError extends Error {
  code: OdooErrorCode;
  retryable: boolean;

  constructor(code: OdooErrorCode) {
    super(ODOO_ERROR_MESSAGES[code]);
    this.name = "OdooError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
  }
}

export class OdooNotConfiguredError extends OdooError {
  constructor() {
    super("ODOO_NOT_CONFIGURED");
    this.name = "OdooNotConfiguredError";
  }
}

function readConfig(): OdooConfig | null {
  const baseUrl = process.env["ODOO_BASE_URL"];
  const database = process.env["ODOO_DATABASE"];
  const username = process.env["ODOO_USERNAME"];
  const apiKey = process.env["ODOO_API_KEY"] ?? process.env["ODOO_PASSWORD"];
  if (!baseUrl || !database || !username || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), database, username, apiKey };
}

export function odooConfigStatus(): OdooConfigStatus {
  return readConfig() ? "configured" : "not_configured";
}

function requireConfig(): OdooConfig {
  const config = readConfig();
  if (!config) throw new OdooNotConfiguredError();
  return config;
}

/** Maps a raw Odoo fault message onto a category. The raw text never leaves the server. */
function classify(raw: string | undefined): OdooErrorCode {
  const text = (raw ?? "").toLowerCase();
  if (!text) return "ODOO_UNKNOWN";
  if (text.includes("access denied") || text.includes("invalid credentials")) {
    return "ODOO_AUTH_FAILED";
  }
  if (text.includes("access error") || text.includes("not allowed")) return "ODOO_PERMISSION_DENIED";
  if (text.includes("object") && text.includes("doesn't exist")) return "ODOO_MODEL_MISSING";
  if (text.includes("invalid model") || text.includes("no such model")) return "ODOO_MODEL_MISSING";
  if (text.includes("missing record") || text.includes("does not exist")) {
    return "ODOO_RECORD_NOT_FOUND";
  }
  if (text.includes("validation") || text.includes("required") || text.includes("constraint")) {
    return "ODOO_VALIDATION";
  }
  return "ODOO_SERVER_ERROR";
}

async function jsonRpc<T>(
  config: OdooConfig,
  service: string,
  method: string,
  args: unknown[],
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
        id: Date.now(),
      }),
    });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    throw new OdooError(name === "TimeoutError" || name === "AbortError" ? "ODOO_TIMEOUT" : "ODOO_UNAVAILABLE");
  }

  if (response.status === 429) throw new OdooError("ODOO_RATE_LIMITED");
  if (response.status === 401 || response.status === 403) throw new OdooError("ODOO_AUTH_FAILED");
  if (response.status >= 500) throw new OdooError("ODOO_SERVER_ERROR");
  if (!response.ok) throw new OdooError("ODOO_UNAVAILABLE");

  let payload: { result?: T; error?: { message?: string; data?: { message?: string } } };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new OdooError("ODOO_MALFORMED_RESPONSE");
  }

  if (payload.error) {
    const code = classify(payload.error.data?.message ?? payload.error.message);
    // Provider details stay server-side; only the category is propagated.
    console.error("[odoo] rpc fault", { service, method, code });
    throw new OdooError(code);
  }

  return payload.result as T;
}

async function authenticate(config: OdooConfig): Promise<number> {
  const uid = await jsonRpc<number | false>(config, "common", "login", [
    config.database,
    config.username,
    config.apiKey,
  ]);
  if (!uid || typeof uid !== "number") throw new OdooError("ODOO_AUTH_FAILED");
  return uid;
}

/** Low-level model call. All Odoo traffic in the app funnels through here. */
export async function odooExecuteKw<T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const config = requireConfig();
  const uid = await authenticate(config);
  return jsonRpc<T>(config, "object", "execute_kw", [
    config.database,
    uid,
    config.apiKey,
    model,
    method,
    args,
    kwargs,
  ]);
}

/** Runs a read-only `search_read` against an Odoo model. */
export async function odooSearchRead<T = Record<string, unknown>>(
  model: string,
  fields: string[],
  domain: unknown[] = [],
  limit = 50,
): Promise<T[]> {
  const rows = await odooExecuteKw<T[]>(model, "search_read", [domain], { fields, limit });
  return rows ?? [];
}

export async function odooCreate(model: string, values: Record<string, unknown>): Promise<number> {
  const id = await odooExecuteKw<number>(model, "create", [values]);
  if (typeof id !== "number") throw new OdooError("ODOO_MALFORMED_RESPONSE");
  return id;
}

export async function odooWrite(
  model: string,
  id: number,
  values: Record<string, unknown>,
): Promise<void> {
  await odooExecuteKw<boolean>(model, "write", [[id], values]);
}

/** True when the given Odoo id still exists — used for idempotent updates. */
export async function odooRecordExists(model: string, id: number): Promise<boolean> {
  const rows = await odooSearchRead<{ id: number }>(model, ["id"], [["id", "=", id]], 1);
  return rows.length > 0;
}

/** Finds an id by an exact field match, or null. Used for departments/leave types. */
export async function odooFindId(
  model: string,
  field: string,
  value: string,
): Promise<number | null> {
  const rows = await odooSearchRead<{ id: number }>(model, ["id"], [[field, "=", value]], 1);
  return rows[0]?.id ?? null;
}

/** Whether a model is installed in the configured Odoo database. */
export async function odooModelInstalled(model: string): Promise<boolean> {
  const rows = await odooSearchRead<{ id: number }>(
    "ir.model",
    ["id"],
    [["model", "=", model]],
    1,
  );
  return rows.length > 0;
}

/** Real authentication round-trip used by the admin connection test. */
export async function odooPing(): Promise<{ ok: true }> {
  const config = requireConfig();
  await authenticate(config);
  // Confirms the HR module is reachable with the configured account.
  await odooSearchRead<{ id: number }>(ODOO_MODELS.EMPLOYEE, ["id"], [], 1);
  return { ok: true };
}
