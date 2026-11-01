import { z } from "zod";
import type { Tokens } from "./admin-session";

const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1), // rotated on every refresh: required
  expiresIn: z.number().int().positive(),
});

async function callRefresh(refreshToken: string): Promise<Tokens | null> {
  const res = await fetch(`${process.env.PICKLEPLAY_API_URL ?? ""}/admin/auth/refresh`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.PICKLEPLAY_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 400 || res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`pickleplay POST /admin/auth/refresh responded ${res.status}`);
  return refreshResponseSchema.parse(await res.json());
}

// The refresh token is single-use: the API treats a second use of an old one as theft and ends the
// session. A page often fires several requests at once after the access token expires, and every one
// of them carries the same old refresh cookie. They share ONE refresh instead of racing, and the
// result is remembered briefly for requests that were already in flight with the old cookie.
const RESULT_TTL_MS = 10_000;
const inFlight = new Map<string, Promise<Tokens | null>>();

/** New tokens, or null when the refresh token is expired/invalid (the user must sign in again). */
export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const attempt = callRefresh(refreshToken);
  inFlight.set(refreshToken, attempt);
  const forget = () => setTimeout(() => inFlight.delete(refreshToken), RESULT_TTL_MS).unref?.();
  // A failure is not remembered, so the next request can try again.
  attempt.then(forget, () => inFlight.delete(refreshToken));
  return attempt;
}
