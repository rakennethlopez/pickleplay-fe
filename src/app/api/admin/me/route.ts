import type { NextRequest } from "next/server";
import { adminForward } from "@/lib/admin-api";

export function GET(request: NextRequest) {
  return adminForward(request, "/admin/auth/me");
}
