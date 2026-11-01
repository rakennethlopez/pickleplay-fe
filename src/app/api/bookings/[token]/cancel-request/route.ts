import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";
import { cancellationRequestFormSchema } from "@/features/booking/schema";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Ask an administrator for an exception after the cutoff. Sending it does not cancel anything. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN.test(token)) return invalid();
  const parsed = cancellationRequestFormSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return forward(`/bookings/by-token/${token}/cancel-request`, {
    method: "POST",
    body: parsed.data,
    request,
  });
}
