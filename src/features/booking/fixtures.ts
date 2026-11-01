import type { Booking, PublicSettings } from "./schema";

export const TOKEN = "a-private-token-0123456789";

export const settings: PublicSettings = {
  timezone: "Asia/Manila",
  holdMinutes: 15,
  slotMinutes: 60,
  maxConsecutiveSlots: 4,
  bookingHorizonDays: 60,
  ratePerHour: null,
  maxReceiptBytes: 5 * 1024 * 1024,
  reviewTargetMinutes: 30,
  dayParts: [],
  smsEnabled: false,
};

/** A confirmed booking more than 24 hours away, which the guest can still cancel themselves. */
export const booking = (over: Partial<Booking> = {}): Booking => ({
  ref: "PP-7K2M9Q",
  court: { id: "c1", name: "Court 2" },
  startsAt: "2026-11-05T10:00:00.000Z",
  endsAt: "2026-11-05T12:00:00.000Z",
  hours: 2,
  totalAmount: null,
  bookingStatus: "confirmed",
  paymentStatus: "approved",
  holdExpiresAt: "2026-10-30T10:00:00.000Z",
  cancellationStatus: "none",
  refundStatus: "not_applicable",
  canSelfCancel: true,
  canRequestCancel: false,
  cancelCodeRequired: false,
  cancelledAt: null,
  cancelledBy: null,
  cancellationRequest: null,
  paymentMethod: "gcash",
  rejectionReason: null,
  maskedPhone: "+63 9•• ••• ••67",
  selfCancelUntil: "2026-11-04T10:00:00.000Z",
  receiptSubmittedAt: "2026-10-30T09:00:00.000Z",
  holdConflict: false,
  createdAt: "2026-10-30T09:00:00.000Z",
  ...over,
});
