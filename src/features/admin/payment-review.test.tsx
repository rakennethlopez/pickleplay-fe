import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/booking/api";
import * as api from "./api";
import { detail, ID, owner, RECEIPT_ID, viewer } from "./fixtures";
import { PaymentReview } from "./payment-review";
import type { AdminProfile } from "./schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/payments",
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getMe: vi.fn(),
  getPayment: vi.fn(),
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
  revealPhone: vi.fn(),
}));

function renderReview(profile: AdminProfile = owner) {
  vi.mocked(api.getMe).mockResolvedValue(profile);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PaymentReview id={ID} />
    </QueryClientProvider>,
  );
}

describe("PaymentReview", () => {
  beforeEach(() => {
    vi.mocked(api.getPayment).mockResolvedValue(detail());
    vi.mocked(api.approvePayment).mockReset();
    vi.mocked(api.rejectPayment).mockReset();
    vi.mocked(api.revealPhone).mockReset();
  });

  it("shows the booking, separate statuses and an honest, read-only history", async () => {
    renderReview();
    expect(await screen.findByText("PP-7K2M9Q")).toBeInTheDocument();
    for (const [label, value] of [
      ["Booking", "Pending review"],
      ["Payment", "Under review"],
      ["Cancellation", "None"],
      ["Refund", "Not applicable"],
    ]) {
      const statuses = screen.getByText(/Statuses · kept separate/).closest("section")!;
      expect(within(statuses).getByText(label)).toBeInTheDocument();
      expect(within(statuses).getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText("Hours held for 15 minutes")).toBeInTheDocument();
    expect(screen.getByText("Nothing here can be edited.")).toBeInTheDocument();
    expect(screen.getByText("Awaiting administrator decision")).toBeInTheDocument();
    expect(screen.getByText(/not proof of payment/i)).toBeInTheDocument();
  });

  it("warns about an overdue payment without deciding anything", async () => {
    vi.mocked(api.getPayment).mockResolvedValue(detail({ overdue: true, overdueMinutes: 23, dueInMinutes: null }));
    renderReview();
    expect(await screen.findByText(/Overdue by 23 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/stays Pending review until an administrator decides/)).toBeInTheDocument();
  });

  describe("opening a receipt", () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
      URL.createObjectURL = vi.fn(() => "blob:receipt-in-memory");
      URL.revokeObjectURL = vi.fn();
    });
    afterEach(() => vi.unstubAllGlobals());

    it("keeps it closed until asked, then fetches it privately and shows it from memory", async () => {
      fetchMock.mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" }), { status: 200 }));
      const user = userEvent.setup();
      renderReview();
      expect(await screen.findByText("The receipt stays closed until you open it.")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled(); // nothing is requested (or logged) until the click

      await user.click(screen.getByRole("button", { name: "Open receipt securely" }));
      const img = await screen.findByRole("img");
      expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/payments/${ID}/receipts/${RECEIPT_ID}`);
      // The picture comes from memory: there is no address to copy, save or share.
      expect(img.getAttribute("src")).toBe("blob:receipt-in-memory");
      expect(screen.getByText(/Never a public or permanent link/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open again/ })).toBeInTheDocument();
    });

    it("says what actually went wrong: expired, not allowed, or a plain failure", async () => {
      const user = userEvent.setup();
      renderReview();
      const open = () => user.click(screen.getByRole("button", { name: /Open (receipt securely|again)/ }));

      fetchMock.mockResolvedValue(new Response("{}", { status: 410 }));
      await user.click(await screen.findByRole("button", { name: "Open receipt securely" }));
      expect(await screen.findByText("Link expired")).toBeInTheDocument();

      fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
      await open();
      expect(await screen.findByText("Receipt hidden · access needed")).toBeInTheDocument();

      fetchMock.mockResolvedValue(new Response("{}", { status: 502 }));
      await open();
      expect(await screen.findByText("We couldn't open the receipt")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  it("masks the phone number, and reveals it only through the logged action", async () => {
    vi.mocked(api.revealPhone).mockResolvedValue({ phone: "+639171234567" });
    const user = userEvent.setup();
    renderReview();
    expect(await screen.findByText("+63 9•• ••• ••67")).toBeInTheDocument();
    expect(screen.queryByText("+639171234567")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Show full number · logged/ }));
    expect(await screen.findByText("+639171234567")).toBeInTheDocument();
    expect(api.revealPhone).toHaveBeenCalledWith(ID);
  });

  describe("for a role that may only look", () => {
    it("hides the decision buttons, receipts and the reveal action, and says why", async () => {
      renderReview(viewer);
      expect(await screen.findByText("You can't do this with your role")).toBeInTheDocument();
      // Both the decision panel and the receipt panel name the role.
      expect(screen.getAllByText(/Your role is Viewer/)).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "Approve Payment" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject Payment" })).not.toBeInTheDocument();
      expect(screen.getByText("Receipt hidden · access needed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Open receipt/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Show full number/ })).not.toBeInTheDocument();
    });
  });

  describe("approving", () => {
    it("needs the 'I checked the account' box, sends one request, and only then says approved", async () => {
      let finish!: (value: ReturnType<typeof detail>) => void;
      vi.mocked(api.approvePayment).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const user = userEvent.setup();
      renderReview();
      await user.click(await screen.findByRole("button", { name: "Approve Payment" }));

      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Approve payment" });
      expect(confirm).toBeDisabled();
      await user.click(within(dialog).getByRole("checkbox"));
      expect(confirm).toBeEnabled();

      await user.click(confirm);
      // While the server works nothing is shown as approved and the buttons are off.
      expect(await within(dialog).findByText(/Nothing is\s+shown as approved yet/)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
      expect(screen.queryByText(/is confirmed by the server/)).not.toBeInTheDocument();

      finish(detail({ paymentStatus: "approved", bookingStatus: "confirmed", decidedAt: "2026-10-30T06:05:00.000Z" }));
      expect(await screen.findByText(/PP-7K2M9Q is confirmed by the server\. Logged: Dev Owner/)).toBeInTheDocument();
      expect(api.approvePayment).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Approve Payment" })).not.toBeInTheDocument());
    });

    it("shows the server's refusal and confirms nothing", async () => {
      vi.mocked(api.approvePayment).mockRejectedValue(
        new ApiError(409, "hours_unavailable", "These hours were booked by someone else, so nothing was confirmed."),
      );
      const user = userEvent.setup();
      renderReview();
      await user.click(await screen.findByRole("button", { name: "Approve Payment" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("checkbox"));
      await user.click(within(dialog).getByRole("button", { name: "Approve payment" }));

      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent("Not approved.");
      expect(alert).toHaveTextContent("booked by someone else");
      expect(alert).toHaveTextContent("Reject with a reason or contact the customer");
      expect(screen.queryByText(/is confirmed by the server/)).not.toBeInTheDocument();
    });
  });

  describe("rejecting", () => {
    it("needs a reason, and sends it with the optional internal note", async () => {
      vi.mocked(api.rejectPayment).mockResolvedValue(
        detail({ paymentStatus: "rejected", bookingStatus: "released", rejectionReason: "amount_mismatch", decidedAt: "2026-10-30T06:05:00.000Z" }),
      );
      const user = userEvent.setup();
      renderReview();
      await user.click(await screen.findByRole("button", { name: "Reject Payment" }));

      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Reject and release hold" });
      expect(confirm).toBeDisabled();

      await user.click(within(dialog).getByRole("radio", { name: "Amount mismatch" }));
      await user.type(within(dialog).getByRole("textbox"), "Sent 500, not 600");
      expect(confirm).toBeEnabled();
      await user.click(confirm);

      await waitFor(() => expect(api.rejectPayment).toHaveBeenCalledWith(ID, { reason: "amount_mismatch", note: "Sent 500, not 600" }));
      expect(await screen.findByText(/released by the server/)).toBeInTheDocument();
    });

    it("tells the guest-facing reason apart from the staff-only note", async () => {
      renderReview();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Reject Payment" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("The customer never sees this note.")).toBeInTheDocument();
      expect(within(dialog).getByText(/customer sees the reason you choose/i)).toBeInTheDocument();
    });
  });

  it("shows the outcome of a payment that was already decided, instead of buttons", async () => {
    vi.mocked(api.getPayment).mockResolvedValue(
      detail({
        paymentStatus: "rejected",
        bookingStatus: "released",
        rejectionReason: "duplicate_receipt",
        rejectionNote: "Same image as PP-AAAAAA",
        decidedAt: "2026-10-30T06:05:00.000Z",
      }),
    );
    renderReview();
    expect(await screen.findByText(/Reason shown to the customer: Duplicate receipt or transaction/)).toBeInTheDocument();
    expect(screen.getByText(/Internal note: Same image as PP-AAAAAA/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Payment" })).not.toBeInTheDocument();
  });
});
