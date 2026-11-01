import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  return adminForward(request, `/admin/cancellations/${id}`);
}
