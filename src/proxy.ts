import { NextResponse, type NextRequest } from "next/server";
import { PASS_COOKIE, passToken, SESSION_COOKIE } from "@/lib/security/session";

/*
 * Runs before every request (Next 16 "proxy", formerly middleware):
 *   1. optional passcode gate (STUDIO_PASSCODE),
 *   2. same-origin check on changing API calls, so other websites can't trigger paid requests (PRD §21.1),
 *   3. an anonymous session cookie for per-session limits.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const passcode = process.env.STUDIO_PASSCODE?.trim();
  if (passcode && pathname !== "/unlock" && pathname !== "/api/unlock") {
    const ok = request.cookies.get(PASS_COOKIE)?.value === (await passToken(passcode));
    if (!ok) {
      if (isApi) return NextResponse.json({ error: { code: "no_session", message: "Enter the studio passcode first.", retryable: false } }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/unlock";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const host = request.headers.get("host");
    const crossOrigin = origin ? safeHost(origin) !== host : site === "cross-site";
    if (crossOrigin) {
      return NextResponse.json({ error: { code: "invalid_request", message: "Requests from other websites aren’t allowed.", retryable: false } }, { status: 403 });
    }
  }

  const response = NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)) {
    response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

function safeHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.svg|favicon.ico).*)"],
};
