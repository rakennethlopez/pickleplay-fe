import { ApiError } from "@/features/booking/api";
import { receiptProblemMessage } from "./receipt-file";

/** What to tell the guest when a receipt upload is refused. null means "not a file problem". */
export function uploadFileMessage(error: unknown, maxBytes: number): string | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case "file_too_large":
      return receiptProblemMessage("size", maxBytes);
    case "invalid_file_type":
      return receiptProblemMessage("type", maxBytes);
    case "file_required":
      return "Choose your receipt first.";
    default:
      return null;
  }
}

/** A general upload failure message for anything that is not a file problem. */
export function uploadFailureMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 429) {
    return "Too many tries. Please wait a moment and try again.";
  }
  return "We couldn't send your receipt. Check your connection and try again. Your hours are still held.";
}
