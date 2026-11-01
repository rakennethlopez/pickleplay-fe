import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/booking/api";
import * as api from "./api";
import { ID, owner, refundDetail, refundItem, refundList, viewer } from "./fixtures";
import { RefundsScreen } from "./refunds-screen";
import type { AdminProfile } from "./schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/refunds",
}));
vi.mock("./api");

function renderScreen(profile: AdminProfile = owner) {
  vi.mocked(api.getMe).mockResolvedValue(profile);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RefundsScreen />
    </QueryClientProvider>,
  );
}

describe("RefundsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getRefunds).mockResolvedValue(refundList());
    vi.mocked(api.getRefund).mockResolvedValue(refundDetail());
  });

  it("says refunds are staff-handled, never promised and never automatic, and lists what is waiting", async () => {
    renderScreen();
    expect(await screen.findByText(/never sent automatically/)).toBeInTheDocument();
    expect((await screen.findAllByText("PP-7K2M9Q")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+63 9•• ••• ••12/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/9171234567/);
  });

  it("offers exactly the steps the server allows from the current status", async () => {
    vi.mocked(api.getRefund).mockResolvedValue(refundDetail({ refundStatus: "processing", nextStatuses: ["processed", "needs_attention"] }));
    renderScreen();
    const steps = await screen.findByRole("group", { name: "Next steps" });
    expect(within(steps).getByRole("button", { name: "Mark processed" })).toBeInTheDocument();
    expect(within(steps).getByRole("button", { name: "Needs attention" })).toBeInTheDocument();
    expect(within(steps).queryByRole("button", { name: "Start processing" })).not.toBeInTheDocument();
    expect(within(steps).queryByRole("button", { name: "Reopen as pending" })).not.toBeInTheDocument();
  });

  it("moves a refund to processing with one confirmation", async () => {
    vi.mocked(api.updateRefund).mockResolvedValue(refundDetail({ refundStatus: "processing", nextStatuses: ["processed", "needs_attention"] }));
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Start processing" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/No money is sent by this action/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Start processing" }));
    await waitFor(() => expect(api.updateRefund).toHaveBeenCalledWith(ID, { to: "processing", note: undefined }));
    expect(await screen.findByText(/is now being processed\. Logged: Dev Owner/)).toBeInTheDocument();
  });

  describe("marking a refund processed", () => {
    async function openProcessed() {
      const user = userEvent.setup();
      renderScreen();
      await user.click(await screen.findByRole("button", { name: "Mark processed" }));
      return { user, dialog: await screen.findByRole("dialog") };
    }

    it("records what was sent: amount, method and reference are all required, and it warns it is final", async () => {
      vi.mocked(api.updateRefund).mockResolvedValue(
        refundDetail({
          refundStatus: "processed",
          nextStatuses: [],
          refund: { amount: "450.00", method: "gcash", reference: "GC-12345", processedAt: "2026-10-30T07:00:00.000Z", processedByName: "Dev Owner" },
        }),
      );
      const { user, dialog } = await openProcessed();
      expect(within(dialog).getByText(/can't be changed afterwards/)).toBeInTheDocument();

      const confirm = within(dialog).getByRole("button", { name: "Mark processed" });
      expect(confirm).toBeDisabled(); // no reference yet
      const [amount, reference] = within(dialog).getAllByRole("textbox").slice(0, 2);
      // The amount starts at the booking cost so the common case is one field away.
      expect(amount).toHaveValue("600.00");
      await user.clear(amount);
      await user.type(amount, "450");
      await user.type(reference, "GC-12345");
      await user.selectOptions(within(dialog).getByRole("combobox"), "gcash");
      expect(confirm).toBeEnabled();
      await user.click(confirm);

      await waitFor(() =>
        expect(api.updateRefund).toHaveBeenCalledWith(ID, { to: "processed", amount: "450.00", method: "gcash", reference: "GC-12345", note: undefined }),
      );
      expect(await screen.findByText(/is marked processed/)).toBeInTheDocument();
      // Final: no more steps, and it says so.
      await waitFor(() => expect(screen.queryByRole("group", { name: "Next steps" })).not.toBeInTheDocument());
      expect(screen.getByText(/it can't be changed/)).toBeInTheDocument();
      expect(screen.getByText("Recorded as sent")).toBeInTheDocument();
    });

    it("will not accept an amount that is not a money amount", async () => {
      const { user, dialog } = await openProcessed();
      const [amount, reference] = within(dialog).getAllByRole("textbox").slice(0, 2);
      await user.type(reference, "REF");
      await user.clear(amount);
      await user.type(amount, "12.345");
      expect(within(dialog).getByRole("button", { name: "Mark processed" })).toBeDisabled();
      await user.clear(amount);
      await user.type(amount, "0");
      expect(within(dialog).getByRole("button", { name: "Mark processed" })).toBeDisabled();
    });

    it("shows the server's refusal and records nothing", async () => {
      vi.mocked(api.updateRefund).mockRejectedValue(new ApiError(400, "amount_exceeds_paid", "That is more than the booking cost"));
      const { user, dialog } = await openProcessed();
      await user.type(within(dialog).getAllByRole("textbox")[1], "REF-1");
      await user.click(within(dialog).getByRole("button", { name: "Mark processed" }));
      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent("Not saved.");
      expect(alert).toHaveTextContent("more than the booking cost");
      expect(screen.queryByText(/is marked processed/)).not.toBeInTheDocument();
    });
  });

  it("keeps the confirmation and the record on screen when a processed refund leaves the To do list", async () => {
    const processed = refundDetail({
      refundStatus: "processed",
      nextStatuses: [],
      refund: { amount: "450.00", method: "gcash", reference: "GC-12345", processedAt: "2026-10-30T07:00:00.000Z", processedByName: "Dev Owner" },
    });
    vi.mocked(api.updateRefund).mockResolvedValue(processed);
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Mark processed" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getAllByRole("textbox")[1], "GC-12345");

    // Processed refunds are not "To do", so the list is empty after this (the other refunds are done too).
    vi.mocked(api.getRefunds).mockResolvedValue(refundList([]));
    vi.mocked(api.getRefund).mockResolvedValue(processed);
    await user.click(within(dialog).getByRole("button", { name: "Mark processed" }));

    expect(await screen.findByText(/Refund for PP-7K2M9Q is marked processed/)).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(api.getRefunds).mock.calls.length).toBeGreaterThan(1));
    expect(screen.queryByText("No refunds need attention")).not.toBeInTheDocument();
    expect(screen.getByText("Recorded as sent")).toBeInTheDocument();
    expect(screen.getByText(/Refund for PP-7K2M9Q is marked processed/)).toBeInTheDocument();
  });

  it("shows a processed refund as final, with the record of what was sent", async () => {
    vi.mocked(api.getRefunds).mockResolvedValue(refundList([refundItem({ refundStatus: "processed" })]));
    vi.mocked(api.getRefund).mockResolvedValue(
      refundDetail({
        refundStatus: "processed",
        nextStatuses: [],
        refund: { amount: "450.00", method: "bank_transfer", reference: "BT-9", processedAt: "2026-10-30T07:00:00.000Z", processedByName: "Rae Processor" },
      }),
    );
    renderScreen();
    expect(await screen.findByText("Recorded as sent")).toBeInTheDocument();
    expect(screen.getByText(/Bank transfer · reference BT-9/)).toBeInTheDocument();
    expect(screen.getByText(/Rae Processor/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Next steps" })).not.toBeInTheDocument();
  });

  it("hides every step from a role that may only look, and says why", async () => {
    renderScreen(viewer);
    expect(await screen.findByText("You can't do this with your role")).toBeInTheDocument();
    expect(screen.getByText(/refund processor role/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Next steps" })).not.toBeInTheDocument();
  });

  it("shows a calm empty state and a clear load failure", async () => {
    vi.mocked(api.getRefunds).mockResolvedValue(refundList([]));
    const { unmount } = renderScreen();
    expect(await screen.findByText("No refunds need attention")).toBeInTheDocument();
    unmount();

    vi.mocked(api.getRefunds).mockRejectedValue(new Error("network"));
    renderScreen();
    expect(await screen.findByText("We couldn't load refunds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
