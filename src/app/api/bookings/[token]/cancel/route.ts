import type { NextRequest } from "next/server";
import { z } from "zod";
import { forward, invalid } from "@/lib/api";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const bodySchema = z.object({ code: z.string().trim().min(4).max(10).optional() });

/** Cancel by yourself, with the private link (and a code when SMS is on). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN.test(token)) return invalid();
  const parsed = bodySchema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return invalid();
  return forward(`/bookings/by-token/${token}/cancel`, {
    method: "POST",
    body: parsed.data,
    request,
  });
}
