import type { NextRequest } from "next/server";
import { z } from "zod";
import { forward, invalid } from "@/lib/api";
import { checkoutRequestSchema } from "@/features/booking/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ holdId: string }> },
) {
  const { holdId } = await params;
  if (!z.uuid().safeParse(holdId).success) return invalid();
  const parsed = checkoutRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return forward(`/holds/${holdId}/checkout`, {
    method: "POST",
    body: parsed.data,
    request,
  });
}
