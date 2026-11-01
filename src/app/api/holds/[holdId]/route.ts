import type { NextRequest } from "next/server";
import { forward, invalid } from "@/lib/api";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ holdId: string }> },
) {
  const { holdId } = await params;
  if (!z.uuid().safeParse(holdId).success) return invalid();
  return forward(`/holds/${holdId}`, { request });
}
