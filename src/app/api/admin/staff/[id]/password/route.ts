import type { NextRequest } from "next/server";
import { invalid } from "@/lib/api";
import { adminProxy, isUuid } from "@/lib/admin-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return invalid();
  return adminProxy(request, `/admin/staff/${id}/password`, "POST");
}
