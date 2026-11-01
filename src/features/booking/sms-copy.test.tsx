import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/booking/api";
import { AskToCancel } from "@/features/cancellation/ask-to-cancel";
import { CheckoutView } from "@/features/checkout/checkout-view";
import { BookingStatusView } from "@/features/status/booking-status-view";
import { booking, settings, TOKEN } from "./fixtures";
import type { Booking, Hold } from "./schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/booking/api", async (original) => ({
  ...(await original<typeof import("@/features/booking/api")>()),
  getHold: vi.fn(),
  getBooking: vi.fn(),
  requestCancellation: vi.fn(),
}));

/** What the page says depends on whether the server can text people: the flag comes from /settings/public. */
function wrap(ui: React.ReactNode, smsEnabled: boolean | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (smsEnabled !== undefined) client.setQueryData(["settings"], { ...settings, smsEnabled });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const HOLD_ID = "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10";
const hold: Hold = {
  id: HOLD_ID,
  ref: "PP-7K2M9Q",
  court: { id: "c1", name: "Court 2" },
  startsAt: "2026-10-30T10:00:00.000Z",
  endsAt: "2026-10-30T12:00:00.000Z",
  hours: 2,
  totalAmount: null,
  bookingStatus: "held",
  paymentStatus: "awaiting_receipt",
  holdExpiresAt: "2999-01-01T00:00:00.000Z",
};

const reviewing = booking({ bookingStatus: "pending_review", paymentStatus: "under_review", canSelfCancel: false });
const requested = booking({
  canSelfCancel: false,
  cancellationStatus: "requested",
  cancellationRequest: {
    ref: "CR-4TQ8WZ",
    status: "pending",
    reason: "Work trip",
    requestedAt: "2026-10-30T08:00:00.000Z",
    decidedAt: null,
    explanation: null,
  },
});

describe("copy that depends on whether SMS is on", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("checkout", () => {
    const hint = (sms: boolean | undefined) => {
      vi.mocked(api.getHold).mockResolvedValue(hold);
      wrap(<CheckoutView holdId={HOLD_ID} />, sms);
    };

    it("says the number finds a lost booking when SMS is off, or while the setting is still loading", async () => {
      hint(false);
      expect(await screen.findByText(/find your booking if you lose your link/)).toBeInTheDocument();
      expect(screen.queryByText(/We text your private booking link/)).not.toBeInTheDocument();
    });

    it("never promises a text before it knows SMS is on", async () => {
      hint(undefined);
      expect(await screen.findByText(/find your booking if you lose your link/)).toBeInTheDocument();
    });

    it("says the link is texted when SMS is on", async () => {
      hint(true);
      expect(await screen.findByText("We text your private booking link here. No account needed.")).toBeInTheDocument();
      expect(screen.queryByText(/if you lose your link/)).not.toBeInTheDocument();
    });
  });

  describe("under review", () => {
    it("says only that the page updates, when SMS is off", () => {
      wrap(<BookingStatusView booking={reviewing} token={TOKEN} />, false);
      expect(screen.getByText(/This page updates on its own, so it's safe to close/)).toBeInTheDocument();
      expect(screen.queryByText(/We'll text/)).not.toBeInTheDocument();
    });

    it("names the masked number the decision will be texted to, when SMS is on", () => {
      wrap(<BookingStatusView booking={reviewing} token={TOKEN} />, true);
      expect(screen.getByText(/We'll text \+63 9•• ••• ••67 with the decision, and this page updates on its own/)).toBeInTheDocument();
    });

    it("still says it without a number (the booking has none to show)", () => {
      wrap(<BookingStatusView booking={{ ...reviewing, maskedPhone: null }} token={TOKEN} />, true);
      expect(screen.getByText(/We'll text you with the decision/)).toBeInTheDocument();
    });

    it("never shows the full number either way", () => {
      wrap(<BookingStatusView booking={reviewing} token={TOKEN} />, true);
      expect(document.body.textContent).not.toContain("9171234567");
    });
  });

  describe("a cancellation request that is waiting", () => {
    it("points to the page when SMS is off", () => {
      wrap(<BookingStatusView booking={requested} token={TOKEN} />, false);
      expect(screen.getByText(/You'll see the decision on this page\./)).toBeInTheDocument();
      expect(screen.queryByText(/We'll text you the decision/)).not.toBeInTheDocument();
    });

    it("also promises a text when SMS is on", () => {
      wrap(<BookingStatusView booking={requested} token={TOKEN} />, true);
      expect(screen.getByText(/We'll text you the decision, and you'll see it on this page too\./)).toBeInTheDocument();
    });

    it("never says the booking is cancelled, either way", () => {
      for (const sms of [false, true]) {
        const { unmount } = wrap(<BookingStatusView booking={requested} token={TOKEN} />, sms);
        expect(screen.getByText(/Your booking is still active/)).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe("after sending a late cancellation request", () => {
    const late = (over: Partial<Booking> = {}) =>
      booking({ canSelfCancel: false, canRequestCancel: true, startsAt: "2026-10-31T10:00:00.000Z", endsAt: "2026-10-31T12:00:00.000Z", ...over });

    async function sendRequest(sms: boolean) {
      vi.mocked(api.getBooking).mockResolvedValue(late());
      vi.mocked(api.requestCancellation).mockResolvedValue(late({ canRequestCancel: false, cancellationRequest: requested.cancellationRequest }));
      const user = userEvent.setup();
      wrap(<AskToCancel token={TOKEN} />, sms);
      await user.type(await screen.findByLabelText(/Why do you need to cancel/), "Work trip came up");
      await user.click(screen.getByRole("button", { name: "Send request" }));
      await screen.findByRole("heading", { name: "We've sent your request" });
    }

    it("says the decision is shown on the booking page, when SMS is off", async () => {
      await sendRequest(false);
      expect(screen.getByText("Decision · shown on your booking page, which updates on its own")).toBeInTheDocument();
    });

    it("says the decision is texted to the masked number, when SMS is on", async () => {
      await sendRequest(true);
      expect(screen.getByText("Decision · we text +63 9•• ••• ••67, and your booking page updates on its own")).toBeInTheDocument();
      expect(screen.getByText(/It is not cancelled, and no refund has been decided/)).toBeInTheDocument();
    });
  });
});
