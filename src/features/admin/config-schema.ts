import { z } from "zod";
import { bookingStatusSchema, paymentStatusSchema } from "@/features/booking/schema";

// Shapes of the admin overview, calendar, bookings, courts, blockouts, pricing, settings and staff
// answers. Each is checked on arrival so a change in the API shows up as an error, not a blank page.

const bookingListItem = z.object({
  id: z.string(),
  ref: z.string(),
  court: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  hours: z.number(),
  guestName: z.string().nullable(),
  maskedPhone: z.string().nullable(),
  bookingStatus: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  cancellationStatus: z.string(),
  refundStatus: z.string(),
});
export type BookingListItem = z.infer<typeof bookingListItem>;

export const bookingListSchema = z.object({ total: z.number(), items: z.array(bookingListItem) });

export const bookingDetailSchema = bookingListItem.extend({
  court: z.object({ id: z.string(), name: z.string() }),
  paymentMethod: z.enum(["gcash", "maya"]).nullable(),
  totalAmount: z.string().nullable(),
  holdExpiresAt: z.string(),
  receiptSubmittedAt: z.string().nullable(),
  reviewDueAt: z.string().nullable(),
  overdue: z.boolean(),
  rejectionReason: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  createdAt: z.string(),
  cancellationRequests: z.array(
    z.object({ id: z.string(), ref: z.string(), status: z.string(), requestedAt: z.string(), decidedAt: z.string().nullable() }),
  ),
  history: z.array(z.object({ at: z.string(), actor: z.string(), text: z.string() })),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

const calendarItem = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("booking"),
    id: z.string(),
    ref: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    bookingStatus: bookingStatusSchema,
    paymentStatus: paymentStatusSchema,
    guestName: z.string().nullable(),
    maskedPhone: z.string().nullable(),
  }),
  z.object({ type: z.literal("blockout"), id: z.string(), startsAt: z.string(), endsAt: z.string(), reason: z.string() }),
]);
export type CalendarItem = z.infer<typeof calendarItem>;

export const calendarSchema = z.object({
  date: z.string(),
  today: z.string(),
  slotMinutes: z.number(),
  slots: z.array(z.string()),
  courts: z.array(z.object({ id: z.string(), name: z.string(), items: z.array(calendarItem) })),
});
export type Calendar = z.infer<typeof calendarSchema>;

export const overviewSchema = z.object({
  now: z.string(),
  today: z.string(),
  kpis: z.object({
    awaitingReview: z.number(),
    overdue: z.number(),
    cancellationRequests: z.number(),
    openRefunds: z.number(),
    bookingsToday: z.number(),
  }),
  upcoming: z.array(bookingListItem),
  timeline: calendarSchema,
});
export type Overview = z.infer<typeof overviewSchema>;

const court = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  sortOrder: z.number(),
  totalBookings: z.number(),
  upcomingBookings: z.number(),
});
export type AdminCourt = z.infer<typeof court>;
export const courtSchema = court;
export const courtListSchema = z.array(court);
export const courtOptionsSchema = z.array(z.object({ id: z.string(), name: z.string() }));

export const blockoutSchema = z.object({
  id: z.string(),
  court: z.object({ id: z.string(), name: z.string() }).nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});
export type Blockout = z.infer<typeof blockoutSchema>;
export const blockoutListSchema = z.object({ items: z.array(blockoutSchema) });

export const emptySchema = z.null();

const window = z.object({ open: z.string(), close: z.string() });
export type OperatingWindow = z.infer<typeof window>;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const pricingSchema = z.object({
  ratePerHour: z.string().nullable(),
  slotMinutes: z.number(),
  maxConsecutiveSlots: z.number(),
  bookingHorizonDays: z.number(),
  operatingHours: z.record(z.string(), z.array(window)),
  dayParts: z.array(z.object({ key: z.string(), label: z.string(), start: z.string(), end: z.string() })),
  gcashNumber: z.string().nullable(),
  gcashAccountName: z.string().nullable(),
  mayaNumber: z.string().nullable(),
  mayaAccountName: z.string().nullable(),
});
export type Pricing = z.infer<typeof pricingSchema>;
export type UpdatePricingRequest = Partial<Omit<Pricing, "ratePerHour">> & { ratePerHour?: number | null };

export const operationsSchema = z.object({
  holdMinutes: z.number(),
  reviewTargetMinutes: z.number(),
  alertLeadMinutes: z.number(),
  lateReceiptGraceMinutes: z.number(),
  adminLockMinutes: z.number(),
  receiptUrlTtlSeconds: z.number(),
  maxReceiptBytes: z.number(),
  receiptRetentionDays: z.number(),
});
export type Operations = z.infer<typeof operationsSchema>;

export const staffSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.object({ id: z.string(), name: z.string() }),
  status: z.enum(["active", "disabled"]),
  lockedUntil: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type StaffMember = z.infer<typeof staffSchema>;
export const staffListSchema = z.object({ items: z.array(staffSchema) });

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(z.string()),
  members: z.number(),
});
export type AdminRole = z.infer<typeof roleSchema>;
export const roleListSchema = z.object({ allPermissions: z.array(z.string()), items: z.array(roleSchema) });

/** What each permission lets a person do, in plain words, for the role editor. */
export const PERMISSION_LABELS: Record<string, string> = {
  "bookings:read": "See the overview, calendar and bookings",
  "payments:read": "See the payment queue",
  "payments:review": "Approve or reject payments",
  "receipts:view": "Open receipt images",
  "phones:reveal": "Show full mobile numbers",
  "cancellations:read": "See cancellation requests",
  "cancellations:decide": "Approve or reject cancellation exceptions",
  "refunds:read": "See refunds",
  "refunds:process": "Record that a refund was sent",
  "courts:manage": "Add, rename, reorder and switch off courts",
  "blockouts:manage": "Close and reopen hours",
  "pricing:manage": "Change the rate, hours and payment accounts",
  "settings:manage": "Change hold, review and retention timings",
  "staff:manage": "Manage staff accounts and roles",
};
