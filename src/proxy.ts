import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { refreshTokens } from "@/lib/admin-refresh";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminCookies,
} from "@/lib/admin-session";

// Protects the admin pages only. The guest booking pages are open to everyone, and /api/* does its
// own session handling (see lib/admin-api.ts). This is a convenience layer that keeps the session
// fresh and sends signed-out people to the sign-in page; the API still checks every request.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  if (request.cookies.get(ADMIN_ACCESS_COOKIE)?.value) return NextResponse.next();

  const toLogin = () => {
    const response = NextResponse.redirect(new URL("/admin/login", request.url));
    clearAdminCookies(response.cookies);
    return response;
  };

  const refresh = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!refresh) return toLogin();

  try {
    const tokens = await refreshTokens(refresh);
    if (!tokens) return toLogin(); // refresh token expired: sign in again

    // Forward the new cookies to this same request's render and persist them in the browser.
    request.cookies.set(ADMIN_ACCESS_COOKIE, tokens.accessToken);
    request.cookies.set(ADMIN_REFRESH_COOKIE, tokens.refreshToken);
    const headers = new Headers(request.headers);
    headers.set("cookie", request.cookies.toString());
    const response = NextResponse.next({ request: { headers } });
    setAdminCookies(response.cookies, tokens);
    return response;
  } catch (error) {
    // The API is unhealthy: keep the cookies so the next request can retry.
    Sentry.captureException(error, { tags: { feature: "admin-refresh" } });
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    {
      source: "/admin/:path*",
      // <Link> prefetches must not spend the rotating refresh token.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
