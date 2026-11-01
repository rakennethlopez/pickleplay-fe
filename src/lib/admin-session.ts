export const ADMIN_ACCESS_COOKIE = "pp_admin_access";
export const ADMIN_REFRESH_COOKIE = "pp_admin_refresh";

// The API rotates the refresh token on every refresh and we re-set this cookie each time, so this
// is a sliding window: set PICKLEPLAY_REFRESH_TTL_SECONDS to the API's REFRESH_TOKEN_TTL_DAYS
// (default 30 days).
export const refreshMaxAge = () =>
  Number(process.env.PICKLEPLAY_REFRESH_TTL_SECONDS) || 60 * 60 * 24 * 30;

export const cookieOptions = (maxAge: number) => ({
  // Never readable from page scripts: a script injected into the admin app cannot steal the session.
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge,
  ...(process.env.PICKLEPLAY_COOKIE_DOMAIN && {
    domain: process.env.PICKLEPLAY_COOKIE_DOMAIN,
  }),
});

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
};

type CookieJar = {
  set(
    name: string,
    value: string,
    options?: ReturnType<typeof cookieOptions>,
  ): unknown;
};

export function setAdminCookies(jar: CookieJar, t: Tokens) {
  jar.set(ADMIN_ACCESS_COOKIE, t.accessToken, cookieOptions(t.expiresIn));
  jar.set(ADMIN_REFRESH_COOKIE, t.refreshToken, cookieOptions(refreshMaxAge()));
}

export function clearAdminCookies(jar: CookieJar) {
  jar.set(ADMIN_ACCESS_COOKIE, "", cookieOptions(0));
  jar.set(ADMIN_REFRESH_COOKIE, "", cookieOptions(0));
}
