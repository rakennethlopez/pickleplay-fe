import { z } from "zod";
import {
  bookingStatusSchema,
  paymentStatusSchema,
  refundStatusSchema,
  rejectionReasonSchema,
} from "@/features/booking/schema";

export { REJECTION_LABELS, rejectionReasonSchema } from "@/features/booking/schema";
export type { RejectionReason } from "@/features/booking/schema";

export const PERMISSIONS = [
  "payments:read",
  "payments:review",
  "receipts:view",
  "phones:reveal",
  "cancellations:read",
  "cancellations:decide",
  "refunds:read",
  "refunds:process",
  "bookings:read",
  "courts:manage",
  "blockouts:manage",
  "pricing:manage",
  "settings:manage",
  "staff:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const profileSchema = z.object({
  email: z.string(),
  displayName: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
});
export type AdminProfile = z.infer<typeof profileSchema>;

export const loginResultSchema = z.object({
  ok: z.literal(true),
  user: profileSchema,
});
export const logoutResultSchema = z.object({ ok: z.literal(true) });

export const loginRequestSchema = z.object({
  email: z.email("Enter your work email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const paymentItemSchema = z.object({
  id: z.string(),
  ref: z.string(),
  court: z.object({ id: z.string(), name: z.string() }),
  startsAt: z.string(),
  endsAt: z.string(),
  hours: z.number(),
  guestName: z.string().nullable(),
  maskedPhone: z.string().nullable(),
  paymentMethod: z.enum(["gcash", "maya"]).nullable(),
  totalAmount: z.string().nullable(),
  bookingStatus: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  submittedAt: z.string().nullable(),
  reviewDueAt: z.string().nullable(),
  overdue: z.boolean(),
  overdueMinutes: z.number(),
  dueSoon: z.boolean(),
  dueInMinutes: z.number().nullable(),
  holdConflict: z.boolean(),
  duplicate: z.boolean(),
  receiptCount: z.number(),
  decidedAt: z.string().nullable(),
  rejectionReason: rejectionReasonSchema.nullable(),
});
export type PaymentItem = z.infer<typeof paymentItemSchema>;

export const paymentListSchema = z.object({
  reviewTargetMinutes: z.number(),
  alertLeadMinutes: z.number(),
  summary: z.object({
    pending: z.number(),
    overdue: z.number(),
    dueSoon: z.number(),
    approvedToday: z.number(),
    rejectedToday: z.number(),
    amountAwaiting: z.string().nullable(),
  }),
  items: z.array(paymentItemSchema),
});
export type PaymentList = z.infer<typeof paymentListSchema>;

export const paymentDetailSchema = paymentItemSchema.extend({
  holdExpiresAt: z.string(),
  statuses: z.object({
    booking: bookingStatusSchema,
    payment: paymentStatusSchema,
    cancellation: z.string(),
    refund: z.string(),
  }),
  rejectionNote: z.string().nullable(),
  receipts: z.array(
    z.object({
      id: z.string(),
      submittedAt: z.string(),
      contentType: z.string(),
      sizeBytes: z.number(),
      duplicate: z.boolean(),
    }),
  ),
  activity: z.array(
    z.object({ at: z.string(), actor: z.string().nullable(), text: z.string() }),
  ),
});
export type PaymentDetail = z.infer<typeof paymentDetailSchema>;

export const approveRequestSchema = z.object({
  confirmMoneyReceived: z.literal(true),
});
export const rejectRequestSchema = z.object({
  reason: rejectionReasonSchema,
  note: z.string().trim().max(500).optional(),
});
export type RejectRequest = z.infer<typeof rejectRequestSchema>;

export const phoneRevealSchema = z.object({ phone: z.string() });

export const paymentFilterSchema = z.enum(["pending", "approved", "rejected", "all"]);
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;

// ---- Late cancellation requests ----------------------------------------------------------------

const historySchema = z.array(
  z.object({ at: z.string(), actor: z.string().nullable(), text: z.string() }),
);

export const cancellationItemSchema = z.object({
  id: z.string(),
  ref: z.string(),
  bookingId: z.string(),
  bookingRef: z.string(),
  court: z.object({ id: z.string(), name: z.string() }),
  startsAt: z.string(),
  endsAt: z.string(),
  hours: z.number(),
  guestName: z.string().nullable(),
  maskedPhone: z.string().nullable(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  requestedAt: z.string(),
  startsInMinutes: z.number(),
  bookingStatus: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  refundStatus: refundStatusSchema,
  paymentMethod: z.enum(["gcash", "maya"]).nullable(),
  totalAmount: z.string().nullable(),
  decidedAt: z.string().nullable(),
  explanation: z.string().nullable(),
  // Staff only.
  internalNote: z.string().nullable(),
});
export type CancellationItem = z.infer<typeof cancellationItemSchema>;

export const cancellationListSchema = z.object({
  summary: z.object({ pending: z.number(), approved: z.number(), rejected: z.number() }),
  items: z.array(cancellationItemSchema),
});
export type CancellationList = z.infer<typeof cancellationListSchema>;

export const cancellationDetailSchema = cancellationItemSchema.extend({ history: historySchema });
export type CancellationDetail = z.infer<typeof cancellationDetailSchema>;

export const cancellationFilterSchema = z.enum(["pending", "approved", "rejected", "all"]);
export type CancellationFilter = z.infer<typeof cancellationFilterSchema>;

export const approveExceptionRequestSchema = z.object({
  refundStatus: z.enum(["not_applicable", "pending"]),
  acknowledge: z.literal(true),
});
export type ApproveExceptionRequest = z.infer<typeof approveExceptionRequestSchema>;

export const rejectExceptionRequestSchema = z.object({
  explanation: z.string().trim().min(3).max(500),
  note: z.string().trim().max(500).optional(),
});
export type RejectExceptionRequest = z.infer<typeof rejectExceptionRequestSchema>;

// ---- Refunds -----------------------------------------------------------------------------------

export const REFUND_METHODS = ["gcash", "maya", "cash", "bank_transfer", "other"] as const;
export const refundMethodSchema = z.enum(REFUND_METHODS);
export type RefundMethod = z.infer<typeof refundMethodSchema>;
export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export const refundItemSchema = z.object({
  id: z.string(),
  ref: z.string(),
  court: z.object({ id: z.string(), name: z.string() }),
  startsAt: z.string(),
  endsAt: z.string(),
  hours: z.number(),
  guestName: z.string().nullable(),
  maskedPhone: z.string().nullable(),
  paymentMethod: z.enum(["gcash", "maya"]).nullable(),
  totalAmount: z.string().nullable(),
  paymentStatus: paymentStatusSchema,
  refundStatus: refundStatusSchema,
  cancelledAt: z.string().nullable(),
  cancelledBy: z.enum(["guest", "exception"]).nullable(),
  refund: z
    .object({
      amount: z.string(),
      method: refundMethodSchema,
      reference: z.string(),
      processedAt: z.string(),
      processedByName: z.string(),
    })
    .nullable(),
});
export type RefundItem = z.infer<typeof refundItemSchema>;

export const refundListSchema = z.object({
  summary: z.object({
    pending: z.number(),
    processing: z.number(),
    needsAttention: z.number(),
    processed: z.number(),
  }),
  items: z.array(refundItemSchema),
});
export type RefundList = z.infer<typeof refundListSchema>;

export const refundDetailSchema = refundItemSchema.extend({
  cancellationRequest: z.object({ ref: z.string(), reason: z.string() }).nullable(),
  // Where the server will let this refund go next.
  nextStatuses: z.array(refundStatusSchema),
  history: historySchema,
});
export type RefundDetail = z.infer<typeof refundDetailSchema>;

export const refundFilterSchema = z.enum([
  "open",
  "pending",
  "processing",
  "needs_attention",
  "processed",
  "none",
  "all",
]);
export type RefundFilter = z.infer<typeof refundFilterSchema>;

const refundNote = z.string().trim().max(500).optional();

// Mirrors what the API accepts, so the BFF refuses a malformed request without calling it.
export const updateRefundRequestSchema = z.discriminatedUnion("to", [
  z.object({ to: z.literal("pending"), note: refundNote }),
  z.object({ to: z.literal("processing"), note: refundNote }),
  z.object({ to: z.literal("needs_attention"), note: refundNote }),
  z.object({ to: z.literal("not_applicable"), note: refundNote }),
  z.object({
    to: z.literal("processed"),
    amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 450 or 450.50"),
    method: refundMethodSchema,
    reference: z.string().trim().min(1, "Enter the reference of the refund").max(100),
    note: refundNote,
  }),
]);
export type UpdateRefundRequest = z.infer<typeof updateRefundRequestSchema>;
