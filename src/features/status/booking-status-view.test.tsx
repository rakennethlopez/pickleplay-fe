import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Booking, PublicSettings } from "@/features/booking/schema";
import { BookingStatusView } from "./booking-status-view";

const settings: PublicSettings = {
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

const booking: Booking = {
  ref: "PP-7K2M9Q",
  court: { id: "c1", name: "Court 2" },
  startsAt: "2026-10-30T10:00:00.000Z",
  endsAt: "2026-10-30T12:00:00.000Z",
  hours: 2,
  totalAmount: null,
  bookingStatus: "held",
  paymentStatus: "awaiting_receipt",
  holdExpiresAt: "2999-01-01T00:00:00.000Z",
  cancellationStatus: "none",
  refundStatus: "not_applicable",
  paymentMethod: "gcash",
  rejectionReason: null,
  maskedPhone: "+63 9•• ••• ••67",
  selfCancelUntil: "2026-10-29T10:00:00.000Z",
  receiptSubmittedAt: null,
  holdConflict: false,
  canSelfCancel: false,
  canRequestCancel: false,
  cancelCodeRequired: false,
  cancelledAt: null,
  cancelledBy: null,
  cancellationRequest: null,
  createdAt: "2026-10-28T10:00:00.000Z",
};

function renderView(overrides: Partial<Booking>, token?: string) {
  const client = new QueryClient();
  client.setQueryData(["settings"], settings);
  return render(
    <QueryClientProvider client={client}>
      <BookingStatusView booking={{ ...booking, ...overrides }} token={token} />
    </QueryClientProvider>,
  );
}

describe("BookingStatusView", () => {
  it("shows a held booking with a countdown and no promise of a booking", () => {
    renderView({});
    expect(screen.getByRole("heading", { name: "Hours held" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText("Awaiting receipt")).toBeInTheDocument();
    expect(screen.getByText(/not booked yet/i)).toBeInTheDocument();
  });

  it("never shows the full phone number", () => {
    renderView({});
    expect(screen.getByText("+63 9•• ••• ••67")).toBeInTheDocument();
  });

  it("shows under review as not booked yet", () => {
    renderView({ bookingStatus: "pending_review", paymentStatus: "under_review" });
    expect(screen.getByRole("heading", { name: /reviewing your receipt/i })).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });

  it("states the configured review target and offers actions only on the private link", () => {
    const review = { bookingStatus: "pending_review", paymentStatus: "under_review" } as const;
    const { unmount } = renderView(review, "a-private-token-0123456789");
    expect(screen.getByText(/within 30 minutes of your receipt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace receipt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy private link/i })).toBeInTheDocument();
    unmount();

    // Reference + mobile lookup is view only: no replace, no link to copy.
    renderView(review);
    expect(screen.queryByRole("button", { name: "Replace receipt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy private link/i })).not.toBeInTheDocument();
  });

  it("keeps a late receipt under review without promising the hours", () => {
    renderView(
      {
        bookingStatus: "released",
        paymentStatus: "under_review",
        holdConflict: true,
        receiptSubmittedAt: "2026-10-30T10:03:00.000Z",
      },
      "a-private-token-0123456789",
    );
    expect(screen.getByRole("heading", { name: "We received your receipt late" })).toBeInTheDocument();
    expect(screen.getByText(/aren't guaranteed to you/i)).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.queryByText(/you're booked/i)).not.toBeInTheDocument();
  });

  it("shows confirmed", () => {
    renderView({ bookingStatus: "confirmed", paymentStatus: "approved" });
    expect(screen.getByRole("heading", { name: "You're booked!" })).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("explains an expired hold using the configured hold time", () => {
    renderView({ bookingStatus: "released" });
    expect(screen.getByRole("heading", { name: "Your 15 minutes are up" })).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose a court and time" })).toBeInTheDocument();
  });

  it("explains a rejected payment and that the hours are not guaranteed", () => {
    renderView({ bookingStatus: "released", paymentStatus: "rejected", rejectionReason: "amount_mismatch" });
    expect(screen.getByRole("heading", { name: /couldn't approve this payment/i })).toBeInTheDocument();
    expect(screen.getByText("Reason from the administrator")).toBeInTheDocument();
    expect(screen.getByText("Amount mismatch")).toBeInTheDocument();
    expect(screen.getByText(/aren't guaranteed to you/i)).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("shows a cancelled booking", () => {
    renderView({ bookingStatus: "cancelled" });
    expect(screen.getByRole("heading", { name: "Booking cancelled" })).toBeInTheDocument();
  });
});
