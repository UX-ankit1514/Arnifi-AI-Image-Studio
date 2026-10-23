import { NextResponse, type NextRequest } from "next/server";
import { PASS_COOKIE, passToken, SESSION_COOKIE } from "@/lib/security/session";

/*
 * Runs before every request (Next 16 "proxy", formerly middleware):
 *   1. passcode gate (STUDIO_PASSCODE) — optional on a Mac, REQUIRED on the live site: a public link must not let
 *      strangers browse internal images or use the ChatGPT plan behind the helper Mac (PRD §21.1),
 *   2. same-origin check on changing API calls, so other websites can't trigger paid requests (PRD §21.1),
 *   3. an anonymous session cookie for per-session limits.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const passcode = process.env.STUDIO_PASSCODE?.trim();
  const hosted = process.env.VERCEL === "1" || process.env.STUDIO_HOSTED === "1";
  if (hosted && !passcode && pathname !== "/unlock") {
    if (isApi) return NextResponse.json({ error: { code: "not_configured", message: "This online studio needs a passcode first: add STUDIO_PASSCODE in the website’s settings.", retryable: false } }, { status: 503 });
    const url = request.nextUrl.clone();
    url.pathname = "/unlock";
    url.search = "?setup=1";
    return NextResponse.rewrite(url);
  }
  if (passcode && pathname !== "/unlock" && pathname !== "/api/unlock") {
    const ok = request.cookies.get(PASS_COOKIE)?.value === (await passToken(passcode));
    if (!ok) {
      if (isApi) return NextResponse.json({ error: { code: "no_session", message: "Enter the studio passcode first.", retryable: false } }, { status: 401 });
      return NextResponse.redirect(sameAddress(request, `/unlock?next=${encodeURIComponent(pathname)}`));
    }
  }

  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const host = request.headers.get("host");
    // With "Referrer-Policy: no-referrer", browsers send `Origin: null` on form posts; then the Fetch-Site header decides.
    const crossOrigin = origin && origin !== "null" ? safeHost(origin) !== host : site === "cross-site" || site === "same-site";
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

/**
 * An absolute URL on the address the browser actually used (its Host header). `request.nextUrl` can say "localhost"
 * while the browser is on 127.0.0.1, and the passcode cookie only works on the address it was set for.
 */
function sameAddress(request: NextRequest, path: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(path, `${proto}://${host}`);
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
