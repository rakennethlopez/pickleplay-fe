import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loginRequestSchema, profileSchema } from "@/features/admin/schema";
import { setAdminCookies } from "@/lib/admin-session";

const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: profileSchema,
});

export async function POST(request: Request) {
  const parsed = loginRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const res = await fetch(`${process.env.PICKLEPLAY_API_URL ?? ""}/admin/auth/login`, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.PICKLEPLAY_API_KEY ?? "",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    // Expected outcomes, not errors: nothing is reported to Sentry for these.
    if (res.status === 401) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    if (res.status === 403) {
      return NextResponse.json({ error: "inactive" }, { status: 403 });
    }
    if (res.status === 429) {
      return NextResponse.json({ error: "locked" }, { status: 429 });
    }
    if (res.status === 400 || res.status === 422) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    if (!res.ok) throw new Error(`pickleplay POST /admin/auth/login responded ${res.status}`);

    // A malformed body throws -> Sentry + 502, never a half-signed-in state.
    const { accessToken, refreshToken, expiresIn, user } = tokenResponseSchema.parse(
      await res.json(),
    );
    const response = NextResponse.json({ ok: true, user });
    setAdminCookies(response.cookies, { accessToken, refreshToken, expiresIn });
    return response;
  } catch (error) {
    // Only the error is reported; the request body (with the password) never leaves this scope.
    Sentry.captureException(error, { tags: { feature: "admin-login" } });
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
