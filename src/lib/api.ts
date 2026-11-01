import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { UPLOAD_HARD_CAP_BYTES } from "@/features/payment/receipt-file";

// Server-only helpers for the BFF: the browser never sees the API URL or key.

/** The guest's IP as seen by our own proxy (the last hop), so the API can rate-limit per guest. */
function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
}

interface ForwardOptions {
  method?: "GET" | "POST";
  /** A JSON body. */
  body?: unknown;
  /** A multipart body (receipt upload); the Content-Type boundary is set by fetch. */
  formData?: FormData;
  request: NextRequest;
}

/**
 * Calls the Pickleplay API with the API key and passes its answer through, so the browser gets the
 * API's status and machine-readable `code` (slot_taken, hold_expired, ...). Server errors become a
 * generic 502 and are reported to Sentry instead of leaking details.
 */
export async function forward(
  path: string,
  { method = "GET", body, formData, request }: ForwardOptions,
) {
  const baseUrl = process.env.PICKLEPLAY_API_URL;
  const apiKey = process.env.PICKLEPLAY_API_KEY;
  if (!baseUrl || !apiKey) {
    Sentry.captureMessage(
      "PICKLEPLAY_API_URL / PICKLEPLAY_API_KEY not configured",
      "error",
    );
    return NextResponse.json({ error: "API config error" }, { status: 500 });
  }

  try {
    const ip = clientIp(request);
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(ip ? { "X-Forwarded-For": ip } : {}),
      },
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      cache: "no-store",
      // Uploads get longer than a JSON call.
      signal: AbortSignal.timeout(formData ? 60000 : 15000),
    });

    if (res.status >= 500) {
      throw new Error(`pickleplay ${method} ${path} responded ${res.status}`);
    }
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "booking" } });
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}

export const invalid = () =>
  NextResponse.json({ error: "invalid" }, { status: 400 });

/**
 * Reads the `file` field of an upload and refuses obvious problems before anything is forwarded:
 * not a file, empty, or over the hard cap. The API then checks the real type and business limit.
 */
export async function readUpload(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: NextResponse.json({ code: "file_required" }, { status: 400 }) };
  }
  if (file.size > UPLOAD_HARD_CAP_BYTES) {
    return {
      error: NextResponse.json({ code: "file_too_large" }, { status: 413 }),
    };
  }
  const formData = new FormData();
  formData.append("file", file, "receipt");
  return { formData };
}
