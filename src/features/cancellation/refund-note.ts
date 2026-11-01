import type { Booking } from "@/features/booking/schema";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";

/**
 * What the guest is told about the refund. It never promises one: a cancellation does not
 * guarantee a refund, and nothing here says money was sent unless staff recorded that it was.
 * Returns null while there is nothing to say (no refund applies).
 */
export function refundNote(booking: Pick<Booking, "refundStatus" | "ref">): string | null {
  switch (booking.refundStatus) {
    case "not_applicable":
      return null;
    case "pending":
      return `A cancellation does not guarantee a refund. Our team will review yours under ${REFUND_POLICY}.`;
    case "processing":
      return "Our team is processing your refund. This page will show when it is done.";
    case "processed":
      return `Your refund was processed. Contact ${CONTACT} with ${booking.ref} if you have questions.`;
    case "needs_attention":
      return `We need to check something about your refund. Please contact ${CONTACT} with ${booking.ref}.`;
  }
}
