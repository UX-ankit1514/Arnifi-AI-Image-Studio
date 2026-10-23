import { NextResponse, type NextRequest } from "next/server";
import { PASS_COOKIE, passToken } from "@/lib/security/session";

/*
 * Passcode screen (required on the live site, optional on a Mac). Redirects are relative ("Location: /settings"), so
 * the browser stays on whatever address it used — the cookie is only valid there.
 */
export async function POST(request: NextRequest) {
  const passcode = process.env.STUDIO_PASSCODE?.trim();
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!passcode || String(form?.get("passcode") ?? "") !== passcode) {
    return new NextResponse(null, { status: 303, headers: { Location: `/unlock?next=${encodeURIComponent(safeNext)}&wrong=1` } });
  }
  const response = new NextResponse(null, { status: 303, headers: { Location: safeNext } });
  response.cookies.set(PASS_COOKIE, await passToken(passcode), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:",
  });
  return response;
}
