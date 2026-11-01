// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_HARD_CAP_BYTES } from "@/features/payment/receipt-file";
import { POST } from "./route";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const HOLD = "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10";
const ctx = (holdId = HOLD) => ({ params: Promise.resolve({ holdId }) });

function upload(form: FormData | null, holdId = HOLD) {
  return POST(
    new NextRequest(`http://localhost/api/holds/${holdId}/receipt`, {
      method: "POST",
      body: form ?? "not a form",
    }),
    ctx(holdId),
  );
}

const png = (size = 100) => new File([new Uint8Array(size)], "my-receipt.png", { type: "image/png" });

describe("POST /api/holds/[holdId]/receipt", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PICKLEPLAY_API_URL", "http://api.test");
    vi.stubEnv("PICKLEPLAY_API_KEY", "secret-key");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects a bad hold id, a missing file and an empty file without calling the API", async () => {
    const form = new FormData();
    form.append("file", png());
    expect((await upload(form, "nope")).status).toBe(400);
    expect((await upload(new FormData())).status).toBe(400);

    const empty = new FormData();
    empty.append("file", new File([], "x.png", { type: "image/png" }));
    expect((await upload(empty)).status).toBe(400);
    expect((await upload(null)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a file over the hard cap before forwarding it", async () => {
    const form = new FormData();
    form.append("file", png(UPLOAD_HARD_CAP_BYTES + 1));
    const res = await upload(form);
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("file_too_large");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the file as multipart with the API key, without the client's file name", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: "t", ref: "PP-AAAAAA" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const form = new FormData();
    form.append("file", png());
    const res = await upload(form);

    expect(res.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.test/holds/${HOLD}/receipt`);
    expect(init.headers["X-API-Key"]).toBe("secret-key");
    // fetch must set the multipart boundary itself.
    expect(init.headers["Content-Type"]).toBeUndefined();
    const sent = (init.body as FormData).get("file") as File;
    expect(sent.name).toBe("receipt");
    expect(sent.type).toBe("image/png");
    expect(sent.size).toBe(100);
  });

  it("passes the API's refusal through so the screen can explain it", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "invalid_file_type" }), {
        status: 415,
        headers: { "content-type": "application/json" },
      }),
    );
    const form = new FormData();
    form.append("file", png());
    const res = await upload(form);
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("invalid_file_type");
  });
});
