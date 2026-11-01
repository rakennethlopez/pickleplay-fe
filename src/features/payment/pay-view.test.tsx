import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/booking/api";
import type { Hold, PaymentInstructions, PublicSettings } from "@/features/booking/schema";
import { PayView } from "./pay-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/booking/api", async (original) => ({
  ...(await original<typeof import("@/features/booking/api")>()),
  getHold: vi.fn(),
  getPayment: vi.fn(),
  submitReceipt: vi.fn(),
}));

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

const payment: PaymentInstructions = {
  ref: "PP-7K2M9Q",
  method: "gcash",
  amount: null,
  account: { number: null, name: null },
  bookingStatus: "held",
  holdExpiresAt: hold.holdExpiresAt,
  maxReceiptBytes: 5 * 1024 * 1024,
  acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
};

const settings: PublicSettings = {
  timezone: "Asia/Manila",
  holdMinutes: 15,
  slotMinutes: 60,
  maxConsecutiveSlots: 4,
  bookingHorizonDays: 60,
  ratePerHour: null,
  maxReceiptBytes: payment.maxReceiptBytes,
  reviewTargetMinutes: 30,
  dayParts: [],
  smsEnabled: false,
};

function renderPay() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["settings"], settings);
  return render(
    <QueryClientProvider client={client}>
      <PayView holdId={HOLD_ID} />
    </QueryClientProvider>,
  );
}

describe("PayView", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(api.getHold).mockResolvedValue(hold);
    vi.mocked(api.getPayment).mockResolvedValue(payment);
    vi.mocked(api.submitReceipt).mockReset();
  });

  it("keeps unset business details bracketed, with nothing to copy", async () => {
    renderPay();
    expect(await screen.findByText("[GCASH NUMBER]")).toBeInTheDocument();
    expect(screen.getByText("[ACCOUNT NAME]")).toBeInTheDocument();
    expect(screen.getByText("[TOTAL]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^copy/i })).not.toBeInTheDocument();
    expect(screen.getByText(/add PP-7K2M9Q in the message/i)).toBeInTheDocument();
  });

  it("shows real account details with copy buttons, and says submitting does not confirm", async () => {
    vi.mocked(api.getPayment).mockResolvedValue({
      ...payment,
      amount: "1200.00",
      account: { number: "0917 000 0000", name: "Pickleplay Courts" },
    });
    renderPay();
    expect(await screen.findByText("0917 000 0000")).toBeInTheDocument();
    expect(screen.getByText("₱1,200.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy number" })).toBeInTheDocument();
    expect(screen.getByText(/does not confirm your booking/i)).toBeInTheDocument();
  });

  it("sends only an acceptable file, then goes to the private page", async () => {
    vi.mocked(api.submitReceipt).mockResolvedValue({
      ref: "PP-7K2M9Q",
      token: "a-private-token-0123456789",
      reviewDueAt: "2026-10-30T10:30:00.000Z",
      holdConflict: false,
    });
    const user = userEvent.setup();
    renderPay();
    const submit = await screen.findByRole("button", { name: "Submit receipt for review" });
    expect(submit).toBeDisabled();

    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    // userEvent honours `accept`, so use applyAccept:false to prove our own check refuses a bad type.
    const strict = userEvent.setup({ applyAccept: false });
    await strict.upload(input, new File(["<b>"], "x.html", { type: "text/html" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload a JPG, PNG or PDF.");
    expect(submit).toBeDisabled();

    await user.upload(input, new File([new Uint8Array(10)], "receipt.png", { type: "image/png" }));
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/booking/a-private-token-0123456789"));
    expect(api.submitReceipt).toHaveBeenCalledWith(HOLD_ID, expect.objectContaining({ name: "receipt.png" }));
  });

  it("explains an expired hold instead of showing the form", async () => {
    vi.mocked(api.getHold).mockResolvedValue({ ...hold, bookingStatus: "released" });
    renderPay();
    expect(await screen.findByRole("heading", { name: "Your 15 minutes are up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit receipt for review" })).not.toBeInTheDocument();
  });

  it("asks for details first when checkout is not done", async () => {
    vi.mocked(api.getPayment).mockRejectedValue(new api.ApiError(409, "checkout_required"));
    renderPay();
    expect(await screen.findByRole("link", { name: "Go to checkout" })).toHaveAttribute(
      "href",
      `/checkout/${HOLD_ID}`,
    );
  });
});
