import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { refreshTokens } from "./admin-refresh";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminCookies,
  type Tokens,
} from "./admin-session";

// Server-only helpers for the admin BFF. The browser holds only httpOnly cookies; this is the one
// place a bearer token is attached to a call to the API.

export class AdminUnauthorized extends Error {}

interface Session {
  accessToken: string;
  /** New tokens, when this request had to renew an expired access token. */
  renewed: Tokens | null;
}

async function sessionFor(request: NextRequest): Promise<Session> {
  const access = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (access) return { accessToken: access, renewed: null };

  // The access cookie expires with the access token: renew it with the refresh token.
  const refresh = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  const renewed = refresh ? await refreshTokens(refresh) : null;
  if (!renewed) throw new AdminUnauthorized();
  return { accessToken: renewed.accessToken, renewed };
}

interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

/** Calls the API as the signed-in administrator. Throws AdminUnauthorized when there is no session. */
export async function adminFetch(
  request: NextRequest,
  path: string,
  { method = "GET", body }: CallOptions = {},
) {
  const session = await sessionFor(request);
  const res = await fetch(`${process.env.PICKLEPLAY_API_URL ?? ""}${path}`, {
    method,
    headers: {
      "X-API-Key": process.env.PICKLEPLAY_API_KEY ?? "",
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  return { res, renewed: session.renewed };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/**
 * Passes an admin screen's request straight to the API: the query string for a read, the JSON body
 * for a change. The shape is only checked as "an object"; the API validates every field and every
 * permission, so this stays a thin pipe rather than a second copy of the rules.
 */
export async function adminProxy(
  request: NextRequest,
  path: string,
  method: NonNullable<CallOptions["method"]> = "GET",
) {
  if (method === "GET") return adminForward(request, `${path}${request.nextUrl.search}`);
  if (method === "DELETE") return adminForward(request, path, { method });
  const body: unknown = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  return adminForward(request, path, { method, body });
}

const signedOut = () => {
  const response = NextResponse.json({ error: "unauthorized" }, { status: 401 });
  clearAdminCookies(response.cookies);
  return response;
};

/** Hands a failure back as a generic response; unexpected errors go to Sentry, never to the browser. */
export function adminFailure(error: unknown) {
  if (error instanceof AdminUnauthorized) return signedOut();
  Sentry.captureException(error, { tags: { feature: "admin" } });
  return NextResponse.json({ error: "failed" }, { status: 502 });
}

/**
 * Calls the API as the signed-in administrator and passes its answer through (status and the
 * machine-readable `code`), renewing the session cookies when needed. A 401 from the API means the
 * session was ended, so the cookies are cleared and the browser goes back to sign-in.
 */
export async function adminForward(
  request: NextRequest,
  path: string,
  options: CallOptions = {},
) {
  try {
    const { res, renewed } = await adminFetch(request, path, options);
    if (res.status === 401) return signedOut();
    if (res.status >= 500) {
      throw new Error(`pickleplay ${options.method ?? "GET"} ${path} responded ${res.status}`);
    }
    // A 204 (a delete) has no body at all; Response refuses even an empty string for it.
    const response = new NextResponse(res.status === 204 ? null : await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
    if (renewed) setAdminCookies(response.cookies, renewed);
    return response;
  } catch (error) {
    return adminFailure(error);
  }
}
