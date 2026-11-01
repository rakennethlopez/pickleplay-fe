import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN.test(token)) return invalid();
  return forward(`/bookings/by-token/${token}`, { request });
}
