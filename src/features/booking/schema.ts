import { z } from "zod";

const dayPart = z.object({
  key: z.string(),
  label: z.string(),
  start: z.string(),
  end: z.string(),
});

export const settingsSchema = z.object({
  timezone: z.string(),
  holdMinutes: z.number(),
  slotMinutes: z.number(),
  maxConsecutiveSlots: z.number(),
  bookingHorizonDays: z.number(),
  ratePerHour: z.string().nullable(),
  maxReceiptBytes: z.number(),
  reviewTargetMinutes: z.number(),
  dayParts: z.array(dayPart),
  smsEnabled: z.boolean(),
});
export type PublicSettings = z.infer<typeof settingsSchema>;

export const slotStatus = z.enum(["open", "held", "booked", "past", "blocked"]);
export type SlotStatus = z.infer<typeof slotStatus>;

const slot = z.object({ startsAt: z.string(), status: slotStatus });
export type Slot = z.infer<typeof slot>;

const courtAvailability = z.object({
  id: z.string(),
  name: z.string(),
  nextOpen: z.string().nullable(),
  slots: z.array(slot),
});
export type CourtAvailability = z.infer<typeof courtAvailability>;

export const availabilitySchema = z.object({
  date: z.string(),
  today: z.string(),
  courts: z.array(courtAvailability),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const rejectionReasonSchema = z.enum([
  "amount_mismatch",
  "reference_mismatch",
  "could_not_verify",
  "invalid_receipt",
  "duplicate_receipt",
  "other",
]);
export type RejectionReason = z.infer<typeof rejectionReasonSchema>;

/** The administrator's reasons, in the words the design package uses. Shown to guests too. */
export const REJECTION_LABELS: Record<RejectionReason, string> = {
  amount_mismatch: "Amount mismatch",
  reference_mismatch: "Payment reference mismatch",
  could_not_verify: "Payment could not be verified",
  invalid_receipt: "Invalid or unreadable receipt",
  duplicate_receipt: "Duplicate receipt or transaction",
  other: "Other",
};

export const bookingStatusSchema = z.enum([
  "held",
  "pending_review",
  "confirmed",
  "released",
  "cancelled",
]);
export const paymentStatusSchema = z.enum([
  "awaiting_receipt",
  "under_review",
  "approved",
  "rejected",
  // The booking was cancelled while its payment was still under review.
  "closed",
]);

export const cancellationStatusSchema = z.enum([
  "none",
  "requested",
  "exception_approved",
  "exception_rejected",
]);
export const refundStatusSchema = z.enum([
  "not_applicable",
  "pending",
  "processing",
  "processed",
  "needs_attention",
]);

const summary = {
  ref: z.string(),
  court: z.object({ id: z.string(), name: z.string() }),
  startsAt: z.string(),
  endsAt: z.string(),
  hours: z.number(),
  totalAmount: z.string().nullable(),
  bookingStatus: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  holdExpiresAt: z.string(),
};

export const holdSchema = z.object({ id: z.string(), ...summary });
export type Hold = z.infer<typeof holdSchema>;

export const bookingSchema = z.object({
  ...summary,
  cancellationStatus: cancellationStatusSchema,
  refundStatus: refundStatusSchema,
  // What the guest may do right now. Decided by the server, so the screen never guesses.
  canSelfCancel: z.boolean(),
  canRequestCancel: z.boolean(),
  // True when the guest must enter a code sent to their mobile number (SMS on).
  cancelCodeRequired: z.boolean(),
  cancelledAt: z.string().nullable(),
  cancelledBy: z.enum(["guest", "exception"]).nullable(),
  // The guest's own late-cancellation request. The staff-only note is never included.
  cancellationRequest: z
    .object({
      ref: z.string(),
      status: z.enum(["pending", "approved", "rejected"]),
      reason: z.string(),
      requestedAt: z.string(),
      decidedAt: z.string().nullable(),
      explanation: z.string().nullable(),
    })
    .nullable(),
  paymentMethod: z.enum(["gcash", "maya"]).nullable(),
  // Why a rejected payment was rejected (the administrator's choice). Never the staff-only note.
  rejectionReason: rejectionReasonSchema.nullable(),
  maskedPhone: z.string().nullable(),
  selfCancelUntil: z.string(),
  receiptSubmittedAt: z.string().nullable(),
  // The receipt arrived after the hold ended, so the hours are not guaranteed.
  holdConflict: z.boolean(),
  createdAt: z.string(),
});
export type Booking = z.infer<typeof bookingSchema>;

export const cancelCodeSchema = z.object({ required: z.boolean() });

export const checkoutResultSchema = z.object({
  ref: z.string(),
  holdExpiresAt: z.string(),
});

export const paymentInstructionsSchema = z.object({
  ref: z.string(),
  method: z.enum(["gcash", "maya"]),
  amount: z.string().nullable(),
  // null until the business supplies its account details.
  account: z.object({ number: z.string().nullable(), name: z.string().nullable() }),
  bookingStatus: bookingStatusSchema,
  holdExpiresAt: z.string(),
  maxReceiptBytes: z.number(),
  acceptedTypes: z.array(z.string()),
});
export type PaymentInstructions = z.infer<typeof paymentInstructionsSchema>;

export const receiptResultSchema = z.object({
  ref: z.string(),
  token: z.string(),
  reviewDueAt: z.string(),
  holdConflict: z.boolean(),
});

export const replaceResultSchema = z.object({
  reviewDueAt: z.string().nullable(),
});

export const createHoldRequestSchema = z.object({
  courtId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  slots: z.number().int().min(1).max(12),
});
export type CreateHoldRequest = z.infer<typeof createHoldRequestSchema>;

export const checkoutRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  mobile: z
    .string()
    .trim()
    .regex(
      /^(?:\+?63|0)\s?9[\d\s()-]{9,13}$/,
      "Enter a Philippine mobile number, like 0917 123 4567",
    ),
  paymentMethod: z.enum(["gcash", "maya"], "Choose GCash or Maya"),
  acceptCancellationPolicy: z.literal(
    true,
    "Agree to the cancellation policy to continue",
  ),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** Matches what the API accepts: a few words at least, and no card or account numbers. */
export const cancellationRequestFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Tell us why you need to cancel")
    .max(500, "Please keep it under 500 characters")
    .refine(
      (value) => !/\b(?:\d[ -]?){13,19}\b/.test(value),
      "Please remove card or account numbers",
    ),
  code: z.string().trim().optional(),
});
export type CancellationRequestForm = z.infer<typeof cancellationRequestFormSchema>;

export const findRequestSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, "Enter your booking reference")
    .regex(/^PP-[A-Za-z0-9]{6}$/, "References look like PP-7K2M9Q"),
  mobile: checkoutRequestSchema.shape.mobile,
});
export type FindRequest = z.infer<typeof findRequestSchema>;
