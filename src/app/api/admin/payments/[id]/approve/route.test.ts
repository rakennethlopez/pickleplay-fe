// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const refreshTokens = vi.fn();
vi.mock("@/lib/admin-refresh", () => ({ refreshTokens: (t: string) => refreshTokens(t) }));

const ID = "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });

function approve(body: unknown, cookies: Record<string, string> = {}, id = ID) {
  return POST(
    new NextRequest(`http://localhost/api/admin/payments/${id}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("POST /api/admin/payments/[id]/approve", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PICKLEPLAY_API_URL", "http://api.test");
    vi.stubEnv("PICKLEPLAY_API_KEY", "secret-key");
  });

  afterEach(() => {
    fetchMock.mockReset();
    refreshTokens.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends nothing to the API without the 'I checked the account' confirmation", async () => {
    expect((await approve({}, { pp_admin_access: "tok" })).status).toBe(400);
    expect((await approve({ confirmMoneyReceived: false }, { pp_admin_access: "tok" })).status).toBe(400);
    expect((await approve({ confirmMoneyReceived: true }, { pp_admin_access: "tok" }, "nope")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the API as the signed-in administrator, never exposing the token to the browser", async () => {
    fetchMock.mockResolvedValue(json({ ref: "PP-AAAAAA" }));
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_access: "the-access-token" });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.test/admin/payments/${ID}/approve`);
    expect(init.headers.Authorization).toBe("Bearer the-access-token");
    expect(init.headers["X-API-Key"]).toBe("secret-key");
    expect(JSON.stringify(await res.json())).not.toContain("the-access-token");
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("renews an expired session with the refresh cookie and hands back httpOnly cookies", async () => {
    refreshTokens.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900 });
    fetchMock.mockResolvedValue(json({ ref: "PP-AAAAAA" }));
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_refresh: "old-refresh" });

    expect(refreshTokens).toHaveBeenCalledWith("old-refresh");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer new-access");
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/pp_admin_access=new-access/);
    expect(setCookie).toMatch(/pp_admin_refresh=new-refresh/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=strict/i);
  });

  it("answers 401 and clears the cookies when there is no usable session", async () => {
    refreshTokens.mockResolvedValue(null);
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_refresh: "dead" });
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/pp_admin_access=;/);
    expect(fetchMock).not.toHaveBeenCalled();

    const none = await approve({ confirmMoneyReceived: true }, {});
    expect(none.status).toBe(401);
  });

  it("clears the session when the API says it ended", async () => {
    fetchMock.mockResolvedValue(json({ message: "Session is no longer valid" }, 401));
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_access: "revoked" });
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/pp_admin_access=;/);
  });

  it("passes the API's refusals through so the dialog can explain them", async () => {
    fetchMock.mockResolvedValue(json({ code: "hours_unavailable", message: "These hours were booked by someone else." }, 409));
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_access: "tok" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("hours_unavailable");

    fetchMock.mockResolvedValue(json({ code: "forbidden" }, 403));
    expect((await approve({ confirmMoneyReceived: true }, { pp_admin_access: "tok" })).status).toBe(403);
  });

  it("turns an API outage into a generic 502 that leaks nothing", async () => {
    fetchMock.mockResolvedValue(new Response("stack trace with secrets", { status: 500 }));
    const res = await approve({ confirmMoneyReceived: true }, { pp_admin_access: "tok" });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secrets");
  });
});
