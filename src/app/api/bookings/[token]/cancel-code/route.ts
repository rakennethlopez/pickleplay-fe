import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Sends the verification code to the booking's mobile number (answers { required: false } while SMS is off). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN.test(token)) return invalid();
  return forward(`/bookings/by-token/${token}/cancel-code`, {
    method: "POST",
    body: {},
    request,
  });
}
