export const RECEIPT_ACCEPT = "image/jpeg,image/png,application/pdf";
const ALLOWED = new Set(RECEIPT_ACCEPT.split(","));

/** The BFF refuses anything bigger without reading it; the API enforces the business limit. */
export const UPLOAD_HARD_CAP_BYTES = 10 * 1024 * 1024;

export type ReceiptFileProblem = "type" | "size" | "empty";

/**
 * Friendly early checks so the guest is told before waiting on an upload. The API still checks the
 * real file contents, so this is a convenience, not the security boundary.
 */
export function checkReceiptFile(
  file: { type: string; size: number },
  maxBytes: number,
): ReceiptFileProblem | null {
  if (file.size === 0) return "empty";
  if (!ALLOWED.has(file.type)) return "type";
  if (file.size > maxBytes) return "size";
  return null;
}

export function receiptProblemMessage(problem: ReceiptFileProblem, maxBytes: number) {
  switch (problem) {
    case "type":
      return "Upload a JPG, PNG or PDF.";
    case "size":
      return `That file is too big. The limit is ${Math.floor(maxBytes / 1024 / 1024)} MB.`;
    case "empty":
      return "That file is empty. Choose your receipt again.";
  }
}

export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
