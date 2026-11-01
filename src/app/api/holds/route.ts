import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";
import { createHoldRequestSchema } from "@/features/booking/schema";

export async function POST(request: NextRequest) {
  const parsed = createHoldRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return forward("/holds", { method: "POST", body: parsed.data, request });
}
