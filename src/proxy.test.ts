// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const refreshTokens = vi.fn();
vi.mock("@/lib/admin-refresh", () => ({ refreshTokens: (t: string) => refreshTokens(t) }));

const request = (path: string, cookies = "") =>
  new NextRequest(`http://localhost${path}`, { headers: cookies ? { cookie: cookies } : {} });

describe("admin proxy", () => {
  beforeEach(() => {
    refreshTokens.mockReset();
  });

  it("lets the sign-in page through, signed in or not", async () => {
    const res = await proxy(request("/admin/login"));
    expect(res.headers.get("location")).toBeNull();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in", async () => {
    const res = await proxy(request("/admin/payments"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("lets a signed-in visitor through without spending the refresh token", async () => {
    const res = await proxy(request("/admin/payments", "pp_admin_access=tok; pp_admin_refresh=ref"));
    expect(res.headers.get("location")).toBeNull();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("renews an expired access token before the page renders", async () => {
    refreshTokens.mockResolvedValue({ accessToken: "new-a", refreshToken: "new-r", expiresIn: 900 });
    const res = await proxy(request("/admin/payments", "pp_admin_refresh=old-r"));
    expect(refreshTokens).toHaveBeenCalledWith("old-r");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.getSetCookie().join("\n")).toMatch(/pp_admin_access=new-a/);
  });

  it("sends the visitor to sign-in when the refresh token has expired", async () => {
    refreshTokens.mockResolvedValue(null);
    const res = await proxy(request("/admin/payments", "pp_admin_refresh=dead"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
    expect(res.headers.getSetCookie().join("\n")).toMatch(/pp_admin_refresh=;/);
  });

  it("keeps the cookies when the API is down, so the next request can retry", async () => {
    refreshTokens.mockRejectedValue(new Error("API down"));
    const res = await proxy(request("/admin/payments", "pp_admin_refresh=ref"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
