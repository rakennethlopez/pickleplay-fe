import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/booking/api";
import { firstSection } from "./admin-shell";
import { BlockoutsScreen } from "./blockouts-screen";
import * as config from "./config-api";
import type { AdminCourt, Calendar } from "./config-schema";
import { CourtsScreen } from "./courts-screen";
import { DayGrid } from "./day-grid";
import { StaffScreen } from "./staff-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getMe: vi.fn(async () => ({ email: "owner@pickleplay.test", displayName: "Owner", role: "Owner", permissions: ["courts:manage"] })),
}));
vi.mock("./config-api", async (original) => ({
  ...(await original<typeof import("./config-api")>()),
  getCourts: vi.fn(),
  createCourt: vi.fn(),
  updateCourt: vi.fn(),
  reorderCourts: vi.fn(),
  getBlockouts: vi.fn(),
  getCourtOptions: vi.fn(),
  createBlockout: vi.fn(),
  removeBlockout: vi.fn(),
  getStaff: vi.fn(),
  getRoles: vi.fn(),
  updateStaff: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const court = (over: Partial<AdminCourt> = {}): AdminCourt => ({
  id: "c1",
  name: "Court 1",
  active: true,
  sortOrder: 1,
  totalBookings: 4,
  upcomingBookings: 0,
  ...over,
});

const clash = {
  id: "b1",
  ref: "PP-7K2M9Q",
  court: "Court 1",
  startsAt: "2026-11-05T10:00:00.000Z",
  endsAt: "2026-11-05T12:00:00.000Z",
  status: "confirmed",
  guestName: "J. Dela Cruz",
};

describe("which section a role opens first", () => {
  it("picks the first section the role can read, and nothing for a role with none", () => {
    expect(firstSection(["bookings:read", "payments:read"])).toBe("/admin/overview");
    expect(firstSection(["payments:read"])).toBe("/admin/payments");
    expect(firstSection(["settings:manage"])).toBe("/admin/pricing");
    expect(firstSection(["staff:manage"])).toBe("/admin/staff");
    expect(firstSection([])).toBeNull();
  });
});

describe("DayGrid", () => {
  const calendar = (over: Partial<Calendar> = {}): Calendar => ({
    date: "2026-11-05",
    today: "2026-11-05",
    slotMinutes: 60,
    slots: ["2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", "2026-11-05T04:00:00.000Z"],
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
    ...over,
  });

  it("says what each hour is in words, never by colour alone", () => {
    wrap(<DayGrid calendar={calendar()} />);
    expect(screen.getByText(/Booked · PP-7K2M9Q · J\. Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText(/Closed · Resurfacing/)).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Court 1" })).toBeInTheDocument();
  });

  it("opens a booking only when the screen lets it", async () => {
    const onSelect = vi.fn();
    wrap(<DayGrid calendar={calendar()} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Booked PP-7K2M9Q, open details/ }));
    expect(onSelect).toHaveBeenCalledWith("b1");
  });

  it("explains a closed day and a day with no courts", () => {
    const { unmount } = wrap(<DayGrid calendar={calendar({ slots: [] })} />);
    expect(screen.getByText("The courts are closed on this day.")).toBeInTheDocument();
    unmount();
    wrap(<DayGrid calendar={calendar({ courts: [] })} />);
    expect(screen.getByText("There are no active courts.")).toBeInTheDocument();
  });
});

describe("CourtsScreen", () => {
  beforeEach(() => vi.resetAllMocks());

  it("adds a court and says guests can book it", async () => {
    vi.mocked(config.getCourts).mockResolvedValue([court()]);
    vi.mocked(config.createCourt).mockResolvedValue(court({ id: "c2", name: "Court 6", sortOrder: 2, totalBookings: 0 }));
    const user = userEvent.setup();
    wrap(<CourtsScreen />);
    await screen.findByDisplayValue("Court 1");

    await user.type(screen.getByLabelText("Add a court"), "Court 6");
    await user.click(screen.getByRole("button", { name: "Add court" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Court 6 was added. Guests can book it now.");
    expect(config.createCourt).toHaveBeenCalledWith("Court 6");
  });

  it("refuses to switch a court off while it has upcoming bookings, and lists them", async () => {
    vi.mocked(config.getCourts).mockResolvedValue([court({ upcomingBookings: 1 })]);
    vi.mocked(config.updateCourt).mockRejectedValue(
      new ApiError(409, "has_upcoming_bookings", "Court 1 still has 1 upcoming booking. Deal with those first.", {
        code: "has_upcoming_bookings",
        bookings: [clash],
      }),
    );
    const user = userEvent.setup();
    wrap(<CourtsScreen />);
    await screen.findByDisplayValue("Court 1");

    await user.click(screen.getByRole("button", { name: "Switch off" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Court 1 still has 1 upcoming booking. Deal with those first.");
    expect(within(alert).getByText("PP-7K2M9Q")).toBeInTheDocument();
    expect(screen.getByText(/On · guests can book it/)).toBeInTheDocument();
  });

  it("can't move the first court up or the last one down", async () => {
    vi.mocked(config.getCourts).mockResolvedValue([court(), court({ id: "c2", name: "Court 2", sortOrder: 2 })]);
    wrap(<CourtsScreen />);
    await screen.findByDisplayValue("Court 1");
    expect(screen.getByRole("button", { name: "Move Court 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Court 2 down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Court 1 down" })).toBeEnabled();
  });
});

describe("BlockoutsScreen", () => {
  beforeEach(() => vi.resetAllMocks());

  const blockout = { id: "x1", court: { id: "c1", name: "Court 1" }, startsAt: "2026-11-05T02:00:00.000Z", endsAt: "2026-11-05T04:00:00.000Z", reason: "Resurfacing", createdByName: "Owner", createdAt: "2026-11-01T00:00:00.000Z" };

  it("shows the bookings that stand in the way, and closes nothing", async () => {
    vi.mocked(config.getBlockouts).mockResolvedValue({ items: [] });
    vi.mocked(config.getCourtOptions).mockResolvedValue([{ id: "c1", name: "Court 1" }]);
    vi.mocked(config.createBlockout).mockRejectedValue(
      new ApiError(409, "has_bookings", "1 booking already sits in those hours. Deal with it first.", { code: "has_bookings", bookings: [clash] }),
    );
    const user = userEvent.setup();
    wrap(<BlockoutsScreen />);
    await screen.findByText("No hours are closed right now.");

    await user.type(screen.getByLabelText("Date"), "2026-11-05");
    await user.type(screen.getByLabelText(/^Reason/), "Tournament set-up");
    await user.click(screen.getByRole("button", { name: "Close these hours" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("1 booking already sits in those hours");
    expect(within(alert).getByText("PP-7K2M9Q")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Philippine time, whatever the browser's own zone is.
    expect(config.createBlockout).toHaveBeenCalledWith(expect.objectContaining({ courtId: null, startsAt: "2026-11-05T09:00:00+08:00", endsAt: "2026-11-05T11:00:00+08:00" }));
  });

  it("asks before reopening hours, and does nothing until confirmed", async () => {
    vi.mocked(config.getBlockouts).mockResolvedValue({ items: [blockout] });
    vi.mocked(config.getCourtOptions).mockResolvedValue([]);
    vi.mocked(config.removeBlockout).mockResolvedValue(null);
    const user = userEvent.setup();
    wrap(<BlockoutsScreen />);

    await user.click(await screen.findByRole("button", { name: "Reopen hours" }));
    expect(config.removeBlockout).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep it closed" }));
    expect(config.removeBlockout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reopen hours" }));
    await user.click(screen.getByRole("button", { name: "Yes, reopen" }));
    await waitFor(() => expect(config.removeBlockout).toHaveBeenCalledWith("x1"));
    expect(await screen.findByRole("status")).toHaveTextContent("The hours are open again");
  });
});

describe("StaffScreen", () => {
  beforeEach(() => vi.resetAllMocks());

  it("won't let you change or switch off your own account", async () => {
    vi.mocked(config.getStaff).mockResolvedValue({
      items: [
        { id: "s1", email: "owner@pickleplay.test", displayName: "Owner", role: { id: "r1", name: "Owner" }, status: "active", lockedUntil: null, lastLoginAt: null, createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "s2", email: "viewer@pickleplay.test", displayName: "Viewer", role: { id: "r1", name: "Owner" }, status: "active", lockedUntil: "2999-01-01T00:00:00.000Z", lastLoginAt: null, createdAt: "2026-10-01T00:00:00.000Z" },
      ],
    });
    vi.mocked(config.getRoles).mockResolvedValue({ allPermissions: ["staff:manage"], items: [{ id: "r1", name: "Owner", description: null, permissions: ["staff:manage"], members: 2 }] });
    wrap(<StaffScreen />);

    const mine = (await screen.findByText("(you)")).closest("li")!;
    expect(within(mine).getByRole("combobox", { name: "Role" })).toBeDisabled();
    expect(within(mine).queryByRole("button", { name: "Switch off" })).not.toBeInTheDocument();

    const theirs = screen.getByText("Viewer").closest("li")!;
    expect(within(theirs).getByRole("combobox", { name: "Role" })).toBeEnabled();
    expect(within(theirs).getByRole("button", { name: "Switch off" })).toBeInTheDocument();
    expect(within(theirs).getByText("Locked")).toBeInTheDocument();
    expect(within(theirs).getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });
});
