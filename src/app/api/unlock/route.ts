import { NextResponse, type NextRequest } from "next/server";
import { PASS_COOKIE, passToken } from "@/lib/security/session";

/* Passcode screen (only when STUDIO_PASSCODE is set). */
export async function POST(request: NextRequest) {
  const passcode = process.env.STUDIO_PASSCODE?.trim();
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const url = request.nextUrl.clone();
  if (!passcode || String(form?.get("passcode") ?? "") !== passcode) {
    url.pathname = "/unlock";
    url.search = `?next=${encodeURIComponent(safeNext)}&wrong=1`;
    return NextResponse.redirect(url, 303);
  }
  url.pathname = safeNext;
  url.search = "";
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(PASS_COOKIE, await passToken(passcode), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return response;
}
