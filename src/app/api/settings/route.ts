import type { NextRequest } from "next/server";
import { forward } from "@/lib/api";

export function GET(request: NextRequest) {
  return forward("/settings/public", { request });
}
