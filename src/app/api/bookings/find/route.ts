import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";
import { findRequestSchema } from "@/features/booking/schema";

export async function POST(request: NextRequest) {
  const parsed = findRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return forward("/bookings/find", {
    method: "POST",
    body: parsed.data,
    request,
  });
}
