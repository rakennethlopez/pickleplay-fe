import { describe, expect, it } from "vitest";
import { refundNote } from "./refund-note";

const note = (refundStatus: Parameters<typeof refundNote>[0]["refundStatus"]) =>
  refundNote({ refundStatus, ref: "PP-7K2M9Q" });

describe("refundNote", () => {
  it("says nothing when no refund applies", () => {
    expect(note("not_applicable")).toBeNull();
  });

  it("never promises a refund while one is only pending", () => {
    expect(note("pending")).toMatch(/does not guarantee a refund/);
    expect(note("pending")).not.toMatch(/will be refunded|you will receive/i);
  });

  it("says a refund was sent only once staff recorded it", () => {
    expect(note("processing")).not.toMatch(/was processed|has been sent/i);
    expect(note("processed")).toMatch(/was processed/);
  });

  it("asks the guest to get in touch when something needs checking", () => {
    expect(note("needs_attention")).toMatch(/contact/i);
    expect(note("needs_attention")).toContain("PP-7K2M9Q");
  });
});
