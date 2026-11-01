import type { NextRequest } from "next/server";
import { z } from "zod";
import { forward, invalid, readUpload } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ holdId: string }> },
) {
  const { holdId } = await params;
  if (!z.uuid().safeParse(holdId).success) return invalid();
  const upload = await readUpload(request);
  if (upload.error) return upload.error;
  return forward(`/holds/${holdId}/receipt`, {
    method: "POST",
    formData: upload.formData,
    request,
  });
}
