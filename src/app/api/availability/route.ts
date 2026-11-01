import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (date !== null && !DATE.test(date)) return invalid();
  return forward(date ? `/availability?date=${date}` : "/availability", {
    request,
  });
}
