// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const TOKEN = "a-private-token-0123456789";
const ctx = (token = TOKEN) => ({ params: Promise.resolve({ token }) });

function post(body: unknown, token = TOKEN) {
  return POST(
    new NextRequest(`http://localhost/api/bookings/${token}/cancel-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(token),
  );
}

describe("POST /api/bookings/[token]/cancel-request", () => {
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

  it("refuses a bad link, a missing reason and a reason holding a card number, without calling the API", async () => {
    expect((await post({ reason: "Work trip" }, "short")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ reason: "x" })).status).toBe(400);
    expect((await post({ reason: "refund to 4111 1111 1111 1111 please" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a good request with the API key and passes the API's answer through", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "request_pending", message: "You already asked to cancel." }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await post({ reason: "Work trip came up" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("request_pending");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.test/bookings/by-token/${TOKEN}/cancel-request`);
    expect(init.headers["X-API-Key"]).toBe("secret-key");
    expect(JSON.parse(init.body)).toEqual({ reason: "Work trip came up" });
  });
});
