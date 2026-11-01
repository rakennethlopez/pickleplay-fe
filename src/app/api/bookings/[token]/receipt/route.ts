import type { NextRequest } from "next/server";
import { forward, invalid, readUpload } from "@/lib/api";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Replace receipt, from the private page. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!TOKEN.test(token)) return invalid();
  const upload = await readUpload(request);
  if (upload.error) return upload.error;
  return forward(`/bookings/by-token/${token}/receipt`, {
    method: "POST",
    formData: upload.formData,
    request,
  });
}
