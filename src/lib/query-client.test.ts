import { describe, expect, it } from "vitest";
import { makeQueryClient } from "./query-client";

describe("makeQueryClient", () => {
  it("returns a fresh client with the default query options", () => {
    const a = makeQueryClient();
    const b = makeQueryClient();
    expect(a).not.toBe(b);
    expect(a.getDefaultOptions().queries).toMatchObject({
      staleTime: 60_000,
      retry: 1,
    });
  });
});
