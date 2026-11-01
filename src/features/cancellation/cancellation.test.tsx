import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/booking/api";
import { booking, settings, TOKEN } from "@/features/booking/fixtures";
import type { Booking } from "@/features/booking/schema";
import { BookingStatusView } from "@/features/status/booking-status-view";
import { AskToCancel } from "./ask-to-cancel";

vi.mock("@/features/booking/api", async (original) => ({
  ...(await original<typeof import("@/features/booking/api")>()),
  getBooking: vi.fn(),
  cancelBooking: vi.fn(),
  requestCancellation: vi.fn(),
  sendCancelCode: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["settings"], settings);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const view = (b: Booking) => wrap(<BookingStatusView booking={b} token={TOKEN} />);

describe("what the booking page offers about cancelling", () => {
  beforeEach(() => vi.resetAllMocks());

  it("offers Cancel booking before the cutoff, and nothing else", () => {
    view(booking());
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ask to cancel" })).not.toBeInTheDocument();
    expect(screen.getByText(/You can cancel yourself until/)).toBeInTheDocument();
  });

  it("offers Ask to cancel after the cutoff, and nothing else", () => {
    view(booking({ canSelfCancel: false, canRequestCancel: true }));
    expect(screen.getByRole("link", { name: "Ask to cancel" })).toHaveAttribute("href", `/booking/${TOKEN}/cancel`);
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(screen.getByText(/ask the administrator to make an exception/i)).toBeInTheDocument();
  });

  it("offers no action without the private link (a lookup by reference + mobile)", () => {
    wrap(<BookingStatusView booking={booking()} />);
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ask to cancel" })).not.toBeInTheDocument();
    expect(screen.getByText(/Open your private link to cancel/)).toBeInTheDocument();
  });

  it("says a request is waiting, that the booking is still active, and offers nothing more", () => {
    view(
      booking({
        canSelfCancel: false,
        canRequestCancel: false,
        cancellationStatus: "requested",
        cancellationRequest: {
          ref: "CR-4TQ8WZ",
          status: "pending",
          reason: "Work trip",
          requestedAt: "2026-11-04T08:00:00.000Z",
          decidedAt: null,
          explanation: null,
        },
      }),
    );
    expect(screen.getByText("Cancellation requested · CR-4TQ8WZ")).toBeInTheDocument();
    expect(screen.getByText(/Your booking is still active/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You're booked!" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ask to cancel" })).not.toBeInTheDocument();
  });

  it("shows the administrator's explanation when a request is declined, and keeps the booking", () => {
    view(
      booking({
        canSelfCancel: false,
        cancellationStatus: "exception_rejected",
        cancellationRequest: {
          ref: "CR-4TQ8WZ",
          status: "rejected",
          reason: "Work trip",
          requestedAt: "2026-11-04T08:00:00.000Z",
          decidedAt: "2026-11-04T09:00:00.000Z",
          explanation: "The court is already prepared for your slot.",
        },
      }),
    );
    expect(screen.getByText("Your request CR-4TQ8WZ was declined")).toBeInTheDocument();
    expect(screen.getByText("The court is already prepared for your slot.")).toBeInTheDocument();
    expect(screen.getByText(/Your booking stays active/)).toBeInTheDocument();
  });

  it("explains a cancelled booking and never promises the refund", () => {
    view(
      booking({
        bookingStatus: "cancelled",
        canSelfCancel: false,
        cancelledBy: "guest",
        cancelledAt: "2026-11-01T08:00:00.000Z",
        refundStatus: "pending",
      }),
    );
    expect(screen.getByRole("heading", { name: "Booking cancelled" })).toBeInTheDocument();
    expect(screen.getByText("You cancelled this booking. The court was released.")).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee a refund/)).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("says when an administrator approved the cancellation, and when no refund applies", () => {
    view(booking({ bookingStatus: "cancelled", canSelfCancel: false, cancelledBy: "exception", refundStatus: "not_applicable" }));
    expect(screen.getByText(/An administrator approved your cancellation request/)).toBeInTheDocument();
    expect(screen.getByText("No refund applies to this booking.")).toBeInTheDocument();
  });
});

describe("cancelling by yourself", () => {
  beforeEach(() => vi.resetAllMocks());

  it("asks first, then cancels once and shows what the server says", async () => {
    const cancelled = booking({ bookingStatus: "cancelled", canSelfCancel: false, cancelledBy: "guest", refundStatus: "pending" });
    vi.mocked(api.cancelBooking).mockResolvedValue(cancelled);
    const user = userEvent.setup();
    view(booking());

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Cancel this booking?")).toBeInTheDocument();
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();
    expect(within(dialog).getByText(/does not guarantee a refund/)).toBeInTheDocument();
    expect(api.cancelBooking).not.toHaveBeenCalled(); // opening the dialog cancels nothing

    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledTimes(1));
    expect(api.cancelBooking).toHaveBeenCalledWith(TOKEN, "");
  });

  it("can be backed out of without cancelling", async () => {
    const user = userEvent.setup();
    view(booking());
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Keep my booking" }));
    expect(api.cancelBooking).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("tells a guest whose window just closed, instead of pretending it worked", async () => {
    vi.mocked(api.cancelBooking).mockRejectedValue(
      new api.ApiError(409, "self_cancel_closed", "Cancelling by yourself has ended for this booking."),
    );
    const user = userEvent.setup();
    view(booking());
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cancelling by yourself has ended");
  });

  it("warns that a payment under review will be ended, and where to ask about money already sent", async () => {
    const user = userEvent.setup();
    view(booking({ bookingStatus: "pending_review", paymentStatus: "under_review" }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Your payment is still being reviewed/)).toBeInTheDocument();
    expect(within(dialog).getByText(/If you already sent money/)).toBeInTheDocument();
  });

  it("asks for a texted code only when the server says one is needed", async () => {
    vi.mocked(api.sendCancelCode).mockResolvedValue({ required: true });
    vi.mocked(api.cancelBooking).mockResolvedValue(booking({ bookingStatus: "cancelled", canSelfCancel: false }));
    const user = userEvent.setup();
    view(booking({ cancelCodeRequired: true }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");

    const confirm = within(dialog).getByRole("button", { name: "Cancel booking" });
    expect(confirm).toBeDisabled(); // no code yet
    await user.click(within(dialog).getByRole("button", { name: "Send code" }));
    expect(api.sendCancelCode).toHaveBeenCalledWith(TOKEN);

    await user.type(within(dialog).getByLabelText("Code from your text message"), "482913");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith(TOKEN, "482913"));
  });

  it("never shows a code step while SMS is off", async () => {
    const user = userEvent.setup();
    view(booking({ cancelCodeRequired: false }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Code from your text message")).not.toBeInTheDocument();
  });
});

describe("asking to cancel after the cutoff", () => {
  const late = (over: Partial<Booking> = {}) =>
    booking({ canSelfCancel: false, canRequestCancel: true, startsAt: "2026-10-31T10:00:00.000Z", endsAt: "2026-10-31T12:00:00.000Z", selfCancelUntil: "2026-10-30T10:00:00.000Z", ...over });

  beforeEach(() => vi.resetAllMocks());

  it("explains it is a request, and that sending it cancels nothing and promises no refund", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(late());
    wrap(<AskToCancel token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: "Ask to cancel" })).toBeInTheDocument();
    expect(screen.getByText(/starts in less than 24 hours/)).toBeInTheDocument();
    expect(screen.getByText(/Sending this does not cancel your booking/)).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee a refund/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Code from your text message")).not.toBeInTheDocument();
  });

  it("needs a reason, refuses card numbers, and shows a character count", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(late());
    const user = userEvent.setup();
    wrap(<AskToCancel token={TOKEN} />);
    const reason = await screen.findByLabelText(/Why do you need to cancel/);
    expect(screen.getByText("0 / 500 characters")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Tell us why you need to cancel")).toBeInTheDocument();

    await user.type(reason, "please refund 4111 1111 1111 1111");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Please remove card or account numbers")).toBeInTheDocument();
    expect(api.requestCancellation).not.toHaveBeenCalled();
  });

  it("sends the request and then shows Request sent, with the booking still active", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(late());
    vi.mocked(api.requestCancellation).mockResolvedValue(
      late({
        canRequestCancel: false,
        cancellationStatus: "requested",
        cancellationRequest: {
          ref: "CR-4TQ8WZ",
          status: "pending",
          reason: "Work trip",
          requestedAt: "2026-10-30T08:00:00.000Z",
          decidedAt: null,
          explanation: null,
        },
      }),
    );
    const user = userEvent.setup();
    wrap(<AskToCancel token={TOKEN} />);
    await user.type(await screen.findByLabelText(/Why do you need to cancel/), "Work trip came up");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "We've sent your request" })).toBeInTheDocument();
    expect(screen.getByText("CR-4TQ8WZ")).toBeInTheDocument();
    expect(screen.getByText(/Your booking is still active\. It is not cancelled, and no refund has been decided/)).toBeInTheDocument();
    expect(api.requestCancellation).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ reason: "Work trip came up" }));
    expect(screen.getByRole("link", { name: "Back to my booking" })).toHaveAttribute("href", `/booking/${TOKEN}`);
  });

  it("explains instead of showing the form when a request is already waiting", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(
      late({
        canRequestCancel: false,
        cancellationStatus: "requested",
        cancellationRequest: { ref: "CR-4TQ8WZ", status: "pending", reason: "x", requestedAt: "2026-10-30T08:00:00.000Z", decidedAt: null, explanation: null },
      }),
    );
    wrap(<AskToCancel token={TOKEN} />);
    expect(await screen.findByText(/You already asked to cancel \(CR-4TQ8WZ\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("sends a guest who can still cancel by themselves back, instead of a pointless request", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(booking());
    wrap(<AskToCancel token={TOKEN} />);
    expect(await screen.findByText(/You can still cancel this booking yourself/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("shows the generic not-found page for a wrong link", async () => {
    vi.mocked(api.getBooking).mockRejectedValue(new api.ApiError(404));
    wrap(<AskToCancel token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: "We can't find that booking" })).toBeInTheDocument();
  });

  it("shows the server's refusal and keeps the form", async () => {
    vi.mocked(api.getBooking).mockResolvedValue(late());
    vi.mocked(api.requestCancellation).mockRejectedValue(new api.ApiError(409, "request_pending", "You already asked to cancel. An administrator will decide."));
    const user = userEvent.setup();
    wrap(<AskToCancel token={TOKEN} />);
    await user.type(await screen.findByLabelText(/Why do you need to cancel/), "Work trip came up");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already asked to cancel");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });
});
