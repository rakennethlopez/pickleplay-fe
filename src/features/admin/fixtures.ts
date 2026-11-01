import type {
  AdminProfile,
  CancellationDetail,
  CancellationItem,
  CancellationList,
  PaymentDetail,
  PaymentItem,
  PaymentList,
  RefundDetail,
  RefundItem,
  RefundList,
} from "./schema";

export const ID = "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10";
export const RECEIPT_ID = "5a1f0c52-3c8e-4a62-9a1b-7d1d2c3b4e5f";

export const item = (over: Partial<PaymentItem> = {}): PaymentItem => ({
  id: ID,
  ref: "PP-7K2M9Q",
  court: { id: "c2", name: "Court 2" },
  startsAt: "2026-10-30T10:00:00.000Z",
  endsAt: "2026-10-30T12:00:00.000Z",
  hours: 2,
  guestName: "J. Dela Cruz",
  maskedPhone: "+63 9•• ••• ••67",
  paymentMethod: "gcash",
  totalAmount: null,
  bookingStatus: "pending_review",
  paymentStatus: "under_review",
  submittedAt: "2026-10-29T21:12:00.000Z",
  reviewDueAt: "2026-10-29T21:42:00.000Z",
  overdue: false,
  overdueMinutes: 0,
  dueSoon: false,
  dueInMinutes: 20,
  holdConflict: false,
  duplicate: false,
  receiptCount: 1,
  decidedAt: null,
  rejectionReason: null,
  ...over,
});

export const detail = (over: Partial<PaymentDetail> = {}): PaymentDetail => ({
  ...item(),
  holdExpiresAt: "2026-10-29T21:18:00.000Z",
  statuses: {
    booking: "pending_review",
    payment: "under_review",
    cancellation: "none",
    refund: "not_applicable",
  },
  rejectionNote: null,
  receipts: [
    {
      id: RECEIPT_ID,
      submittedAt: "2026-10-29T21:12:00.000Z",
      contentType: "image/png",
      sizeBytes: 2048,
      duplicate: false,
    },
  ],
  activity: [
    { at: "2026-10-29T21:03:00.000Z", actor: null, text: "Hours held for 15 minutes" },
    {
      at: "2026-10-29T21:12:00.000Z",
      actor: null,
      text: "Receipt submitted inside the hold. Review target: 30 minutes",
    },
  ],
  ...over,
});

export const list = (items: PaymentItem[] = [item()]): PaymentList => ({
  reviewTargetMinutes: 30,
  alertLeadMinutes: 10,
  summary: {
    pending: items.length,
    overdue: items.filter((i) => i.overdue).length,
    dueSoon: items.filter((i) => i.dueSoon).length,
    approvedToday: 18,
    rejectedToday: 2,
    amountAwaiting: null,
  },
  items,
});

export const REQUEST_ID = "7c1f0c52-3c8e-4a62-9a1b-7d1d2c3b4e5f";

export const cancellation = (over: Partial<CancellationItem> = {}): CancellationItem => ({
  id: REQUEST_ID,
  ref: "CR-4TQ8WZ",
  bookingId: ID,
  bookingRef: "PP-7K2M9Q",
  court: { id: "c2", name: "Court 2" },
  startsAt: "2026-10-30T10:00:00.000Z",
  endsAt: "2026-10-30T12:00:00.000Z",
  hours: 2,
  guestName: "J. Dela Cruz",
  maskedPhone: "+63 9•• ••• ••12",
  reason: "Work trip came up and I can't make it.",
  status: "pending",
  requestedAt: "2026-10-29T22:40:00.000Z",
  startsInMinutes: 680,
  bookingStatus: "confirmed",
  paymentStatus: "approved",
  refundStatus: "not_applicable",
  paymentMethod: "gcash",
  totalAmount: "600.00",
  decidedAt: null,
  explanation: null,
  internalNote: null,
  ...over,
});

export const cancellationDetail = (over: Partial<CancellationDetail> = {}): CancellationDetail => ({
  ...cancellation(),
  history: [{ at: "2026-10-29T22:40:00.000Z", actor: "Customer", text: "Request sent by customer" }],
  ...over,
});

export const cancellationList = (items: CancellationItem[] = [cancellation()]): CancellationList => ({
  summary: { pending: items.filter((i) => i.status === "pending").length, approved: 5, rejected: 2 },
  items,
});

export const refundItem = (over: Partial<RefundItem> = {}): RefundItem => ({
  id: ID,
  ref: "PP-7K2M9Q",
  court: { id: "c2", name: "Court 2" },
  startsAt: "2026-11-05T10:00:00.000Z",
  endsAt: "2026-11-05T12:00:00.000Z",
  hours: 2,
  guestName: "J. Dela Cruz",
  maskedPhone: "+63 9•• ••• ••12",
  paymentMethod: "gcash",
  totalAmount: "600.00",
  paymentStatus: "approved",
  refundStatus: "pending",
  cancelledAt: "2026-10-30T08:00:00.000Z",
  cancelledBy: "guest",
  refund: null,
  ...over,
});

export const refundDetail = (over: Partial<RefundDetail> = {}): RefundDetail => ({
  ...refundItem(),
  cancellationRequest: null,
  nextStatuses: ["processing", "processed", "needs_attention", "not_applicable"],
  history: [
    { at: "2026-10-30T08:00:00.000Z", actor: "Guest (private link)", text: "Customer cancelled the booking before the cutoff. Court released" },
  ],
  ...over,
});

export const refundList = (items: RefundItem[] = [refundItem()]): RefundList => ({
  summary: { pending: items.length, processing: 1, needsAttention: 0, processed: 7 },
  items,
});

const ALL = [
  "payments:read",
  "payments:review",
  "receipts:view",
  "phones:reveal",
  "cancellations:read",
  "cancellations:decide",
  "refunds:read",
  "refunds:process",
] as const;

export const owner: AdminProfile = {
  email: "owner@pickleplay.test",
  displayName: "Dev Owner",
  role: "Owner",
  permissions: [...ALL],
};

export const viewer: AdminProfile = {
  email: "viewer@pickleplay.test",
  displayName: "Front Desk",
  role: "Viewer",
  permissions: ["payments:read", "cancellations:read", "refunds:read"],
};
