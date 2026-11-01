import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/booking/api";
import { booking, settings, TOKEN } from "@/features/booking/fixtures";
import { BlockoutsScreen } from "@/features/admin/blockouts-screen";
import * as config from "@/features/admin/config-api";
import { CourtsScreen } from "@/features/admin/courts-screen";
import { DayGrid } from "@/features/admin/day-grid";
import { PricingScreen } from "@/features/admin/pricing-screen";
import { StaffScreen } from "@/features/admin/staff-screen";
import { CheckoutView } from "@/features/checkout/checkout-view";
import { BookingStatusView } from "@/features/status/booking-status-view";

// Automated accessibility checks (axe-core) on the screens guests and staff use most. jsdom has no
// layout, so colour contrast is not measured here: tokens are checked by hand against 4.5:1.

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/booking/api", async (original) => ({
  ...(await original<typeof import("@/features/booking/api")>()),
  getHold: vi.fn(),
}));
vi.mock("@/features/admin/api", async (original) => ({
  ...(await original<typeof import("@/features/admin/api")>()),
  getMe: vi.fn(async () => ({ email: "owner@pickleplay.test", displayName: "Owner", role: "Owner", permissions: ["pricing:manage", "settings:manage"] })),
}));
vi.mock("@/features/admin/config-api", async (original) => ({
  ...(await original<typeof import("@/features/admin/config-api")>()),
  getCourts: vi.fn(),
  getBlockouts: vi.fn(),
  getCourtOptions: vi.fn(),
  getStaff: vi.fn(),
  getRoles: vi.fn(),
  getPricing: vi.fn(),
  getOperations: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["settings"], settings);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

describe("accessibility (axe)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("guest: the private booking page, in review and confirmed", async () => {
    const { container, unmount } = wrap(
      <BookingStatusView booking={booking({ bookingStatus: "pending_review", paymentStatus: "under_review", canSelfCancel: false })} token={TOKEN} />,
    );
    expect(await violations(container)).toEqual([]);
    unmount();
    const confirmed = wrap(<BookingStatusView booking={booking()} token={TOKEN} />);
    expect(await violations(confirmed.container)).toEqual([]);
  });

  it("guest: checkout", async () => {
    vi.mocked(api.getHold).mockResolvedValue({
      id: "0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10",
      ref: "PP-7K2M9Q",
      court: { id: "c1", name: "Court 2" },
      startsAt: "2026-10-30T10:00:00.000Z",
      endsAt: "2026-10-30T12:00:00.000Z",
      hours: 2,
      totalAmount: null,
      bookingStatus: "held",
      paymentStatus: "awaiting_receipt",
      holdExpiresAt: "2999-01-01T00:00:00.000Z",
    });
    const { container } = wrap(<CheckoutView holdId="0b8d3a5e-6f1c-4d57-9a43-2f6f7a1c9e10" />);
    await screen.findByLabelText("Full name");
    expect(await violations(container)).toEqual([]);
  });

  it("staff: the day grid", async () => {
    const { container } = wrap(
      <DayGrid
        onSelect={() => undefined}
        calendar={{
          date: "2026-11-05",
          today: "2026-11-05",
          slotMinutes: 60,
          slots: ["2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z"],
          courts: [
            {
              id: "c1",
              name: "Court 1",
              items: [
                { type: "booking", id: "b1", ref: "PP-7K2M9Q", startsAt: "2026-11-05T02:00:00.000Z", endsAt: "2026-11-05T03:00:00.000Z", bookingStatus: "confirmed", paymentStatus: "approved", guestName: "J. Dela Cruz", maskedPhone: null },
                { type: "blockout", id: "x1", startsAt: "2026-11-05T03:00:00.000Z", endsAt: "2026-11-05T04:00:00.000Z", reason: "Resurfacing" },
              ],
            },
          ],
        }}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("staff: courts, blocked hours, staff and pricing screens", async () => {
    vi.mocked(config.getCourts).mockResolvedValue([{ id: "c1", name: "Court 1", active: true, sortOrder: 1, totalBookings: 2, upcomingBookings: 1 }]);
    const courts = wrap(<CourtsScreen />);
    await screen.findByDisplayValue("Court 1");
    expect(await violations(courts.container)).toEqual([]);
    courts.unmount();

    vi.mocked(config.getBlockouts).mockResolvedValue({ items: [] });
    vi.mocked(config.getCourtOptions).mockResolvedValue([{ id: "c1", name: "Court 1" }]);
    const blockouts = wrap(<BlockoutsScreen />);
    await screen.findByText("No hours are closed right now.");
    expect(await violations(blockouts.container)).toEqual([]);
    blockouts.unmount();

    vi.mocked(config.getStaff).mockResolvedValue({
      items: [{ id: "s2", email: "viewer@pickleplay.test", displayName: "Viewer", role: { id: "r1", name: "Owner" }, status: "active", lockedUntil: null, lastLoginAt: null, createdAt: "2026-10-01T00:00:00.000Z" }],
    });
    vi.mocked(config.getRoles).mockResolvedValue({ allPermissions: ["staff:manage"], items: [{ id: "r1", name: "Owner", description: null, permissions: ["staff:manage"], members: 1 }] });
    const staff = wrap(<StaffScreen />);
    await screen.findByText("Viewer");
    expect(await violations(staff.container)).toEqual([]);
    staff.unmount();

    vi.mocked(config.getPricing).mockResolvedValue({
      ratePerHour: null,
      slotMinutes: 60,
      maxConsecutiveSlots: 4,
      bookingHorizonDays: 60,
      operatingHours: { "1": [{ open: "08:00", close: "24:00" }] },
      dayParts: [{ key: "morning", label: "Morning", start: "06:00", end: "12:00" }],
      gcashNumber: null,
      gcashAccountName: null,
      mayaNumber: null,
      mayaAccountName: null,
    });
    vi.mocked(config.getOperations).mockResolvedValue({ holdMinutes: 15, reviewTargetMinutes: 30, alertLeadMinutes: 10, lateReceiptGraceMinutes: 5, adminLockMinutes: 15, receiptUrlTtlSeconds: 300, maxReceiptBytes: 5242880, receiptRetentionDays: 90 });
    const pricing = wrap(<PricingScreen />);
    await screen.findByText("Rate and booking rules");
    expect(await violations(pricing.container)).toEqual([]);
  });
});
