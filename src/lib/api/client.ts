import { clientEnv } from "@/config/env";

/** Thrown when a service is architected but its backend is not connected yet. */
export class ServiceNotConnectedError extends Error {
  constructor(operation: string) {
    super(
      `${operation} is not connected yet. The Dayflow integration layer will be wired up in a later phase.`,
    );
    this.name = "ServiceNotConnectedError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Single HTTP entry point for the frontend. All services go through here so
 * transport concerns (auth headers, error shape, base URL) live in one place.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (signal) init.signal = signal;
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed`, response.status);
  }

  return (await response.json()) as T;
}
