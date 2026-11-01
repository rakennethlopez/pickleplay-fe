// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tokens = (n: number) =>
  new Response(JSON.stringify({ accessToken: `a${n}`, refreshToken: `r${n}`, expiresIn: 900 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("refreshTokens", () => {
  const fetchMock = vi.fn();
  let refreshTokens: typeof import("./admin-refresh").refreshTokens;

  beforeEach(async () => {
    vi.resetModules(); // a fresh in-flight cache for every test
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PICKLEPLAY_API_URL", "http://api.test");
    vi.stubEnv("PICKLEPLAY_API_KEY", "secret-key");
    ({ refreshTokens } = await import("./admin-refresh"));
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shares one refresh between simultaneous requests carrying the same refresh token", async () => {
    // The refresh token is single-use: two parallel refreshes would make the API end the session.
    fetchMock.mockImplementation(async () => tokens(1));
    const [a, b, c] = await Promise.all([refreshTokens("old"), refreshTokens("old"), refreshTokens("old")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a?.refreshToken).toBe("r1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/admin/auth/refresh");
    expect(init.headers["X-API-Key"]).toBe("secret-key");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "old" });
  });

  it("still remembers the answer for a request that arrives just after, with the same old cookie", async () => {
    fetchMock.mockImplementation(async () => tokens(1));
    await refreshTokens("old");
    await refreshTokens("old");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes separately for different sessions", async () => {
    fetchMock.mockImplementation(async () => tokens(1));
    await Promise.all([refreshTokens("one"), refreshTokens("two")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when the API says the refresh token is no longer valid", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await refreshTokens("expired")).toBeNull();
  });

  it("does not remember a failure, so the next request can try again", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(refreshTokens("old")).rejects.toThrow(/500/);
    fetchMock.mockImplementation(async () => tokens(2));
    expect((await refreshTokens("old"))?.accessToken).toBe("a2");
  });
});
