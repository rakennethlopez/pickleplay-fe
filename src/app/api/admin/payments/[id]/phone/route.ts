import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";

/** Shows the full mobile number. The API checks the role and logs who revealed it, every time. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  return adminForward(request, `/admin/payments/${id}/phone-reveal`, {
    method: "POST",
  });
}
