import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { adminFetch, AdminUnauthorized } from "@/lib/admin-api";
import { clearAdminCookies } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  try {
    // The API ends the session identified by the bearer token. If the access token has expired it is
    // renewed first, otherwise the session would stay alive on the API until the refresh token expires.
    const { res } = await adminFetch(request, "/admin/auth/logout", { method: "POST" });
    // 204 = ended. 401/404 = already gone, which is what we want.
    if (!res.ok && res.status !== 401 && res.status !== 404) {
      throw new Error(`pickleplay POST /admin/auth/logout responded ${res.status}`);
    }
  } catch (error) {
    if (!(error instanceof AdminUnauthorized)) {
      // Not fatal for the user, but the session may outlive the click until it expires.
      Sentry.captureException(error, { tags: { feature: "admin-logout" } });
    }
  }

  // Whatever happened above, the browser is signed out locally.
  const response = NextResponse.json({ ok: true });
  clearAdminCookies(response.cookies);
  return response;
}
