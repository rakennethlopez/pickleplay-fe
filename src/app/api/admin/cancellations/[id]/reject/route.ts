import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";
import { rejectExceptionRequestSchema } from "@/features/admin/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const parsed = rejectExceptionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  return adminForward(request, `/admin/cancellations/${id}/reject`, {
    method: "POST",
    body: parsed.data,
  });
}
