import { describe, expect, it } from "vitest";
import { checkReceiptFile, formatBytes, receiptProblemMessage } from "./receipt-file";

const MAX = 5 * 1024 * 1024;

describe("checkReceiptFile", () => {
  it("accepts JPG, PNG and PDF within the limit", () => {
    for (const type of ["image/jpeg", "image/png", "application/pdf"]) {
      expect(checkReceiptFile({ type, size: 1000 }, MAX)).toBeNull();
    }
    expect(checkReceiptFile({ type: "image/png", size: MAX }, MAX)).toBeNull();
  });

  it("refuses other types, empty files and files over the limit", () => {
    expect(checkReceiptFile({ type: "text/html", size: 10 }, MAX)).toBe("type");
    expect(checkReceiptFile({ type: "image/gif", size: 10 }, MAX)).toBe("type");
    expect(checkReceiptFile({ type: "image/png", size: 0 }, MAX)).toBe("empty");
    expect(checkReceiptFile({ type: "image/png", size: MAX + 1 }, MAX)).toBe("size");
  });
});

describe("messages", () => {
  it("explains each problem in plain words", () => {
    expect(receiptProblemMessage("type", MAX)).toBe("Upload a JPG, PNG or PDF.");
    expect(receiptProblemMessage("size", MAX)).toBe("That file is too big. The limit is 5 MB.");
    expect(receiptProblemMessage("empty", MAX)).toMatch(/empty/);
  });

  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
