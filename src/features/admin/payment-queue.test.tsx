import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { item, list, owner } from "./fixtures";
import { PaymentQueue } from "./payment-queue";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/payments",
}));
vi.mock("./api");

function renderQueue() {
  // The hook retries a failed load once; no delay, so the failure shows up quickly.
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PaymentQueue />
    </QueryClientProvider>,
  );
}

describe("PaymentQueue", () => {
  beforeEach(() => {
    vi.mocked(api.getMe).mockResolvedValue(owner);
    vi.mocked(api.getPayments).mockReset();
  });

  it("shows the summary and each payment with its deadline and flags", async () => {
    vi.mocked(api.getPayments).mockResolvedValue(
      list([
        item({ overdue: true, overdueMinutes: 23, dueInMinutes: null, duplicate: true }),
        item({
          id: "second",
          ref: "PP-AAAAAA",
          guestName: "M. Santos",
          dueSoon: true,
          dueInMinutes: 7,
          holdConflict: true,
        }),
      ]),
    );
    renderQueue();

    expect((await screen.findAllByText("PP-7K2M9Q")).length).toBeGreaterThan(0);
    expect(screen.getByText("Pending payments")).toBeInTheDocument();
    expect(screen.getByText("1 overdue · 1 due soon")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument(); // approved today
    // No rate set yet: the amount stays bracketed rather than showing a misleading zero.
    expect(screen.getByText("[AMOUNT]")).toBeInTheDocument();

    expect(screen.getAllByText("Overdue 23 min").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Still pending\. Not auto-approved\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Duplicate receipt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Due soon · 7 min left").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hold conflict").length).toBeGreaterThan(0);
    // Phones are always masked in the queue.
    expect(screen.getAllByText("+63 9•• ••• ••67").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/9171234567/);
    expect(screen.getAllByRole("link", { name: "Review" })[0]).toHaveAttribute("href", `/admin/payments/${item().id}`);
  });

  it("says plainly that overdue items are never decided automatically", async () => {
    vi.mocked(api.getPayments).mockResolvedValue(list());
    renderQueue();
    // The review target comes from the server, so wait for it before checking the rest.
    expect(await screen.findByText(/Review target: 30 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/never approved, discarded or released automatically/i)).toBeInTheDocument();
  });

  it("shows a calm empty state", async () => {
    vi.mocked(api.getPayments).mockResolvedValue(list([]));
    renderQueue();
    expect(await screen.findByText("No payments are waiting")).toBeInTheDocument();
  });

  it("explains a load failure, says nothing changed, and can retry", async () => {
    vi.mocked(api.getPayments).mockRejectedValue(new Error("network"));
    renderQueue();
    expect(await screen.findByText("We couldn't load payments")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was approved or rejected/)).toBeInTheDocument();

    vi.mocked(api.getPayments).mockResolvedValue(list());
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("PP-7K2M9Q")).length).toBeGreaterThan(0);
  });

  it("filters by status and searches after a short pause", async () => {
    vi.mocked(api.getPayments).mockResolvedValue(list());
    const user = userEvent.setup();
    renderQueue();
    await screen.findAllByText("PP-7K2M9Q");

    await user.click(screen.getByRole("button", { name: "Approved" }));
    await waitFor(() => expect(api.getPayments).toHaveBeenCalledWith("approved", ""));

    await user.type(screen.getByRole("searchbox", { name: "Search payments" }), "PP-7K");
    await waitFor(() => expect(api.getPayments).toHaveBeenCalledWith("approved", "PP-7K"));
    // It did not search on every keystroke.
    expect(vi.mocked(api.getPayments).mock.calls.filter(([, q]) => q !== "")).toHaveLength(1);
  });
});
