import type { NextRequest } from "next/server";
import { invalid } from "@/lib/api";
import { adminForward, isUuid } from "@/lib/admin-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return invalid();
  return adminForward(request, `/admin/staff/${id}/unlock`, { method: "POST" });
}
