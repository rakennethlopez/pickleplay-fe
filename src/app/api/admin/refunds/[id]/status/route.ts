import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";
import { updateRefundRequestSchema } from "@/features/admin/schema";

/** Moves a refund along. The API checks the role and the allowed steps; this only checks the shape. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const parsed = updateRefundRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return adminForward(request, `/admin/refunds/${id}/status`, {
    method: "POST",
    body: parsed.data,
  });
}
