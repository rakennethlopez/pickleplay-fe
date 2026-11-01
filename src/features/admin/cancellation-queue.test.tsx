import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/booking/api";
import * as api from "./api";
import { CancellationQueue } from "./cancellation-queue";
import { cancellation, cancellationDetail, cancellationList, owner, REQUEST_ID, viewer } from "./fixtures";
import type { AdminProfile } from "./schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/cancellations",
}));
vi.mock("./api");

function renderQueue(profile: AdminProfile = owner) {
  vi.mocked(api.getMe).mockResolvedValue(profile);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CancellationQueue />
    </QueryClientProvider>,
  );
}

describe("CancellationQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList());
    vi.mocked(api.getCancellation).mockResolvedValue(cancellationDetail());
  });

  it("lists requests with how soon they start, and says a request does not cancel anything", async () => {
    renderQueue();
    expect((await screen.findAllByText(/CR-4TQ8WZ/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Starts in 11 h 20 min")).toBeInTheDocument();
    expect(screen.getByText(/does not cancel anything/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/\+63 9•• ••• ••12/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/9171234567/);
  });

  it("shows the selected request with the reason, a read-only history and the policy", async () => {
    renderQueue();
    expect(await screen.findByText("Request sent by customer")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Selected request" });
    expect(within(panel).getByText(/Work trip came up/)).toBeInTheDocument();
    expect(within(panel).getByText(/Nothing is refunded automatically/)).toBeInTheDocument();
    expect(within(panel).getByText(/Audit history · read only/)).toBeInTheDocument();
  });

  it("shows a calm empty state", async () => {
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList([]));
    renderQueue();
    expect(await screen.findByText("No requests are waiting")).toBeInTheDocument();
  });

  it("explains a load failure, says nothing changed, and can retry", async () => {
    vi.mocked(api.getCancellations).mockRejectedValue(new Error("network"));
    renderQueue();
    expect(await screen.findByText("We couldn't load requests")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was approved or rejected/)).toBeInTheDocument();
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList());
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText(/CR-4TQ8WZ/)).length).toBeGreaterThan(0);
  });

  it("switches between requests", async () => {
    const second = cancellation({ id: "second", ref: "CR-ZZZZZ2", bookingRef: "PP-AAAAAA", guestName: "A. Reyes" });
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList([cancellation(), second]));
    vi.mocked(api.getCancellation).mockImplementation(async (id) =>
      cancellationDetail(id === "second" ? { ...second, history: [] } : {}),
    );
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText("Request sent by customer");
    await user.click(screen.getByRole("button", { name: /CR-ZZZZZ2/ }));
    await waitFor(() => expect(api.getCancellation).toHaveBeenCalledWith("second"));
    expect((await screen.findByRole("heading", { name: "CR-ZZZZZ2" }))).toBeInTheDocument();
  });

  describe("for a role that may only look", () => {
    it("hides Approve and Reject, and says why", async () => {
      renderQueue(viewer);
      expect(await screen.findByText("You can't do this with your role")).toBeInTheDocument();
      expect(screen.getByText(/cancellation approver role/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Approve exception" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject exception" })).not.toBeInTheDocument();
    });
  });

  describe("approving", () => {
    async function openApprove() {
      const user = userEvent.setup();
      renderQueue();
      await user.click(await screen.findByRole("button", { name: "Approve exception" }));
      return { user, dialog: await screen.findByRole("dialog") };
    }

    it("needs the 'I understand' box, and cancels only after the server says so", async () => {
      let finish!: (value: ReturnType<typeof cancellationDetail>) => void;
      vi.mocked(api.approveException).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { user, dialog } = await openApprove();

      const confirm = within(dialog).getByRole("button", { name: "Cancel the booking" });
      expect(confirm).toBeDisabled();
      expect(within(dialog).getByText(/does not issue a refund by itself/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("checkbox"));
      await user.click(confirm);

      expect(await within(dialog).findByText(/still\s+shows as booked/)).toBeInTheDocument();
      expect(screen.queryByText(/is cancelled and/)).not.toBeInTheDocument();
      expect(api.approveException).toHaveBeenCalledWith(REQUEST_ID, { refundStatus: "not_applicable", acknowledge: true });

      finish(cancellationDetail({ status: "approved", bookingStatus: "cancelled", refundStatus: "not_applicable", decidedAt: "2026-10-30T06:52:00.000Z" }));
      expect(await screen.findByText(/PP-7K2M9Q is cancelled and Court 2/)).toBeInTheDocument();
    });

    it("records the refund as pending only when chosen, and only for a paid booking", async () => {
      vi.mocked(api.approveException).mockResolvedValue(cancellationDetail({ status: "approved", bookingStatus: "cancelled", refundStatus: "pending" }));
      const { user, dialog } = await openApprove();
      await user.click(within(dialog).getByRole("radio", { name: /Pending manual processing/ }));
      await user.click(within(dialog).getByRole("checkbox"));
      await user.click(within(dialog).getByRole("button", { name: "Cancel the booking" }));
      await waitFor(() => expect(api.approveException).toHaveBeenCalledWith(REQUEST_ID, { refundStatus: "pending", acknowledge: true }));
    });

    it("does not offer a refund when no payment was accepted yet", async () => {
      vi.mocked(api.getCancellation).mockResolvedValue(cancellationDetail({ paymentStatus: "under_review", refundStatus: "not_applicable" }));
      const { dialog } = await openApprove();
      expect(within(dialog).getByRole("radio", { name: /Pending manual processing/ })).toBeDisabled();
      expect(within(dialog).getByText(/No payment was accepted yet/)).toBeInTheDocument();
    });

    it("shows the server's refusal and confirms nothing", async () => {
      vi.mocked(api.approveException).mockRejectedValue(new ApiError(409, "booking_not_active", "This booking is no longer active, so there is nothing to cancel"));
      const { user, dialog } = await openApprove();
      await user.click(within(dialog).getByRole("checkbox"));
      await user.click(within(dialog).getByRole("button", { name: "Cancel the booking" }));
      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent("Not cancelled.");
      expect(alert).toHaveTextContent("no longer active");
      expect(alert).toHaveTextContent("still active");
      expect(screen.queryByText(/is cancelled and/)).not.toBeInTheDocument();
    });
  });

  describe("rejecting", () => {
    it("needs an explanation for the customer, and keeps the staff note separate", async () => {
      vi.mocked(api.rejectException).mockResolvedValue(cancellationDetail({ status: "rejected", explanation: "The court is prepared.", decidedAt: "2026-10-30T06:52:00.000Z" }));
      const user = userEvent.setup();
      renderQueue();
      await user.click(await screen.findByRole("button", { name: "Reject exception" }));
      const dialog = await screen.findByRole("dialog");

      const confirm = within(dialog).getByRole("button", { name: "Reject exception" });
      expect(confirm).toBeDisabled();
      expect(within(dialog).getByText("The customer sees this on their booking page.")).toBeInTheDocument();
      expect(within(dialog).getByText(/The reservation stays active/)).toBeInTheDocument();

      const [explanation, note] = within(dialog).getAllByRole("textbox");
      await user.type(explanation, "The court is prepared.");
      await user.type(note, "Regular who cancels a lot");
      await user.click(confirm);

      await waitFor(() =>
        expect(api.rejectException).toHaveBeenCalledWith(REQUEST_ID, { explanation: "The court is prepared.", note: "Regular who cancels a lot" }),
      );
      expect(await screen.findByText(/Exception rejected\. CR-4TQ8WZ is logged and PP-7K2M9Q stays active/)).toBeInTheDocument();
    });
  });

  it("keeps the confirmation and the outcome on screen when the decided request leaves the Pending list", async () => {
    const decided = cancellationDetail({ status: "approved", bookingStatus: "cancelled", refundStatus: "pending", decidedAt: "2026-10-30T06:52:00.000Z" });
    vi.mocked(api.approveException).mockResolvedValue(decided);
    const user = userEvent.setup();
    renderQueue();
    await user.click(await screen.findByRole("button", { name: "Approve exception" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));

    // From now on the Pending list is empty, as it is once the last request has been decided.
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList([]));
    vi.mocked(api.getCancellation).mockResolvedValue(decided);
    await user.click(within(dialog).getByRole("button", { name: "Cancel the booking" }));

    expect(await screen.findByText(/PP-7K2M9Q is cancelled and Court 2/)).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(api.getCancellations).mock.calls.length).toBeGreaterThan(1)); // the list refreshed...
    expect(screen.queryByText("No requests are waiting")).not.toBeInTheDocument(); // ...but we did not jump to "empty"
    // The selected request's panel still shows how it was decided.
    const panel = await screen.findByRole("region", { name: "Selected request" });
    expect(within(panel).getByText(/Approved · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2},/)).toBeInTheDocument();
    expect(screen.getByText(/PP-7K2M9Q is cancelled and Court 2/)).toBeInTheDocument();
  });

  it("shows the outcome of a decided request instead of buttons", async () => {
    vi.mocked(api.getCancellations).mockResolvedValue(cancellationList([cancellation({ status: "rejected" })]));
    vi.mocked(api.getCancellation).mockResolvedValue(
      cancellationDetail({ status: "rejected", explanation: "The court is prepared.", internalNote: "Regular", decidedAt: "2026-10-30T06:52:00.000Z" }),
    );
    renderQueue();
    expect(await screen.findByText(/Explanation shown to the customer: The court is prepared/)).toBeInTheDocument();
    expect(screen.getByText(/Internal note: Regular/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve exception" })).not.toBeInTheDocument();
  });

  it("warns when the booking is no longer active, and only offers to close the request", async () => {
    vi.mocked(api.getCancellation).mockResolvedValue(cancellationDetail({ bookingStatus: "released" }));
    renderQueue();
    expect(await screen.findByText(/no longer active, so there is nothing to cancel/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve exception" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject exception" })).toBeInTheDocument();
  });
});
