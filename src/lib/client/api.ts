import type { ErrorCode } from "@/types/generation";

/* Browser → API calls with one error shape, so every screen can show the server's plain-language message. */

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode | "not_found" | "file_invalid" | "no_session" | "network",
    readonly retryable: boolean,
    readonly resetAt: string | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function handle<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err = body?.error;
    throw new ApiClientError(err?.message ?? `Something went wrong (${response.status}). Try again.`, response.status, err?.code ?? "provider_error", err?.retryable ?? response.status >= 500, err?.resetAt ?? null);
  }
  return body as T;
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: "same-origin" });
  } catch {
    throw new ApiClientError("Image Studio can’t be reached. Check that the app is still running and try again.", 0, "network", true);
  }
  return handle<T>(response);
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => send<T>(url, { signal, cache: "no-store" }),
  post: <T>(url: string, body?: unknown) => send<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => send<T>(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  del: <T>(url: string) => send<T>(url, { method: "DELETE" }),
  upload: <T>(url: string, form: FormData) => send<T>(url, { method: "POST", body: form }),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
