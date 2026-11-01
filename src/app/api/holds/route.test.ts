// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

const COURT = "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10";
const body = { courtId: COURT, startsAt: "2026-10-30T18:00:00+08:00", slots: 2 };

function post(payload: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/holds", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
    }),
  );
}

describe("POST /api/holds", () => {
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

  it("rejects a malformed request without calling the API", async () => {
    const res = await post({ courtId: "nope", slots: 0 });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards with the API key and the guest's IP, and returns the API answer", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "h1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await post(body, { "x-forwarded-for": "9.9.9.9, 203.0.113.7" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "h1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/holds");
    expect(init.headers["X-API-Key"]).toBe("secret-key");
    expect(init.headers["X-Forwarded-For"]).toBe("203.0.113.7");
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it("passes a slot_taken refusal through so the screen can handle it", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "slot_taken", message: "taken" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await post(body);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("slot_taken");
  });

  it("turns an API outage into a generic 502 that leaks nothing", async () => {
    fetchMock.mockResolvedValue(new Response("db password is hunter2", { status: 500 }));
    const res = await post(body);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });

  it("reports a missing configuration instead of calling out", async () => {
    vi.stubEnv("PICKLEPLAY_API_KEY", "");
    const res = await post(body);
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
