import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invalid } from "@/lib/api";
import { AdminUnauthorized, adminFailure, adminFetch } from "@/lib/admin-api";
import { setAdminCookies } from "@/lib/admin-session";

/**
 * Streams one receipt to a signed-in administrator. The API creates a signed link that expires in
 * minutes and logs the view; this route follows it server-side and passes the bytes through, so the
 * browser never gets a link it could save, share or reuse.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  const { id, receiptId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(receiptId).success) {
    return invalid();
  }

  try {
    const { res: linkRes, renewed } = await adminFetch(
      request,
      `/admin/payments/${id}/receipts/${receiptId}/link`,
      { method: "POST" },
    );
    if (linkRes.status === 401) return adminFailure(new AdminUnauthorized());
    if (linkRes.status === 403 || linkRes.status === 404) {
      return NextResponse.json(await linkRes.json().catch(() => ({})), { status: linkRes.status });
    }
    if (!linkRes.ok) throw new Error(`receipt link responded ${linkRes.status}`);
    const { path } = z.object({ path: z.string().startsWith("/receipts/files/") }).parse(await linkRes.json());

    const file = await fetch(`${process.env.PICKLEPLAY_API_URL ?? ""}${path}`, {
      headers: { "X-API-Key": process.env.PICKLEPLAY_API_KEY ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!file.ok || !file.body) throw new Error(`receipt file responded ${file.status}`);

    const response = new NextResponse(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": "inline",
        // Private: never cached by the browser or a proxy, never sniffed into another type.
        "Cache-Control": "private, no-store",
        // The API only stores files whose real bytes are JPG, PNG or PDF; this stops any re-typing.
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (renewed) setAdminCookies(response.cookies, renewed);
    return response;
  } catch (error) {
    return adminFailure(error);
  }
}
