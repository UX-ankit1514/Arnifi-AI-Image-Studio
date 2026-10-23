import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { MissingFileError } from "@/lib/storage/blobStore";
import { DraftNotFoundError } from "@/lib/storage/draftStore";
import { StorageUnavailableError } from "@/lib/database/firestore";
import { ImageNotFoundError } from "@/lib/database/imageRepository";
import { FileValidationError } from "@/lib/validation/files";
import { firstIssue } from "@/lib/validation/schemas";
import type { ErrorCode } from "@/types/generation";
import { SESSION_COOKIE } from "@/lib/security/session";

/* Small helpers shared by the API routes: consistent JSON errors with plain-language messages (PRD FR-09). */

export interface ApiError {
  error: { code: ErrorCode | "not_found" | "file_invalid" | "no_session"; message: string; retryable: boolean; resetAt?: string | null; field?: string };
}

export function apiError(status: number, code: ApiError["error"]["code"], message: string, extra: Partial<ApiError["error"]> = {}) {
  return NextResponse.json<ApiError>({ error: { code, message, retryable: status >= 500 || status === 429, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps anything a route throws to the right status and a message people can act on. Never leaks internals. */
export function fromError(e: unknown) {
  if (e instanceof ZodError) return apiError(400, "invalid_request", firstIssue(e));
  if (e instanceof FileValidationError) return apiError(400, "file_invalid", e.message, { field: e.code });
  if (e instanceof StorageUnavailableError) return apiError(503, "not_configured", e.message);
  if (e instanceof ImageNotFoundError) return apiError(404, "not_found", e.message);
  if (e instanceof DraftNotFoundError) return apiError(404, "not_found", e.message);
  if (e instanceof MissingFileError) return apiError(410, "not_found", `${e.message} The details are still saved; upload the file again to restore it.`);
  console.error("[api]", e);
  if (isStorageFailure(e)) return apiError(503, "storage_failed", "The image couldn’t be saved because the library storage didn’t respond. Nothing was lost — try again.", { retryable: true });
  return apiError(500, "provider_error", "Something went wrong on our side. Try again — if it keeps happening, restart the app.");
}

function isStorageFailure(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /firestore|grpc|DEADLINE_EXCEEDED|UNAVAILABLE|RESOURCE_EXHAUSTED|PERMISSION_DENIED|ECONNREFUSED|ENOTFOUND/i.test(msg);
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ZodError([{ code: "custom", message: "The request body isn’t valid JSON.", path: [], input: undefined }]);
  }
  return schema.parse(body);
}

export function sessionOf(request: NextRequest): string | null {
  const sid = request.cookies.get(SESSION_COOKIE)?.value;
  return sid && /^[0-9a-f-]{20,64}$/i.test(sid) ? sid : null;
}

export function noSession() {
  return apiError(401, "no_session", "Your session has expired. Reload the page and try again.");
}

export function fileResponse(data: Buffer, mimeType: string, opts: { filename?: string; immutable?: boolean } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Length": String(data.length),
    "Cache-Control": opts.immutable ? "private, max-age=31536000, immutable" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename}"`;
  return new NextResponse(new Uint8Array(data), { status: 200, headers });
}
