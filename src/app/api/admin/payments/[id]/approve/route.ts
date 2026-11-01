import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";
import { approveRequestSchema } from "@/features/admin/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const parsed = approveRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  // Without the "I checked the account" confirmation nothing is sent to the API.
  if (!parsed.success) return invalid();
  return adminForward(request, `/admin/payments/${id}/approve`, {
    method: "POST",
    body: parsed.data,
  });
}
