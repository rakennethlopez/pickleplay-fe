import type { NextRequest } from "next/server";
import { invalid } from "@/lib/api";
import { adminForward } from "@/lib/admin-api";
import { refundFilterSchema } from "@/features/admin/schema";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = refundFilterSchema.safeParse(params.get("status") ?? "open");
  const q = params.get("q") ?? "";
  if (!status.success || q.length > 100) return invalid();

  const query = new URLSearchParams({ status: status.data });
  if (q.trim()) query.set("q", q.trim());
  return adminForward(request, `/admin/refunds?${query}`);
}
