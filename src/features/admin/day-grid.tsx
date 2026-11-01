"use client";

import { Ban, CircleCheck, Clock, Search } from "lucide-react";
import { timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Calendar, CalendarItem } from "./config-schema";

type Booking = Extract<CalendarItem, { type: "booking" }>;

const STATE = {
  held: { label: "Held", Icon: Clock, className: "bg-amber/10 text-amber border-amber border-dashed" },
  pending_review: { label: "Under review", Icon: Search, className: "bg-amber/10 text-amber border-amber" },
  confirmed: { label: "Booked", Icon: CircleCheck, className: "bg-court-green text-primary-foreground border-court-green" },
  released: { label: "Released", Icon: Ban, className: "bg-muted text-slate border-border" },
  cancelled: { label: "Cancelled", Icon: Ban, className: "bg-muted text-slate border-border" },
} as const;

const overlaps = (item: CalendarItem, start: number, end: number) =>
  new Date(item.startsAt).getTime() < end && new Date(item.endsAt).getTime() > start;

/**
 * One day, hours down the side and courts across the top. Every cell says what it is in words and an
 * icon, never by colour alone. Drawn from the server's slot list, so it follows the opening hours.
 */
export function DayGrid({
  calendar,
  onSelect,
}: {
  calendar: Calendar;
  onSelect?: (bookingId: string) => void;
}) {
  const slotMs = calendar.slotMinutes * 60_000;
  if (calendar.slots.length === 0) {
    return <p className="text-slate bg-card border-border rounded-[14px] border p-5 text-sm">The courts are closed on this day.</p>;
  }
  if (calendar.courts.length === 0) {
    return <p className="text-slate bg-card border-border rounded-[14px] border p-5 text-sm">There are no active courts.</p>;
  }
  return (
    <div className="bg-card border-border overflow-x-auto rounded-[14px] border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">Courts by hour for {calendar.date}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-slate border-border sticky left-0 w-20 border-b bg-card p-2 text-left text-xs font-medium">
              Time
            </th>
            {calendar.courts.map((c) => (
              <th key={c.id} scope="col" className="text-ink border-border border-b p-2 text-left font-semibold">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.slots.map((slot) => {
            const start = new Date(slot).getTime();
            return (
              <tr key={slot}>
                <th scope="row" className="text-slate border-border sticky left-0 border-b bg-card p-2 text-left text-xs font-medium whitespace-nowrap">
                  {timeLabel(slot)}
                </th>
                {calendar.courts.map((court) => {
                  const hit = court.items.find((i) => overlaps(i, start, start + slotMs));
                  return (
                    <td key={court.id} className="border-border h-12 border-b p-1 align-middle">
                      {hit ? <Cell item={hit} onSelect={onSelect} /> : <span className="text-slate text-xs">Free</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ item, onSelect }: { item: CalendarItem; onSelect?: (id: string) => void }) {
  if (item.type === "blockout") {
    return (
      <span className="bg-muted text-slate border-border flex min-h-10 items-center gap-1 rounded-lg border border-dashed px-2 text-xs" title={item.reason}>
        <Ban className="size-3 shrink-0" aria-hidden />
        <span className="truncate">Closed · {item.reason}</span>
      </span>
    );
  }
  return <BookingCell booking={item} onSelect={onSelect} />;
}

function BookingCell({ booking, onSelect }: { booking: Booking; onSelect?: (id: string) => void }) {
  const { label, Icon, className } = STATE[booking.bookingStatus];
  const body = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">
        {label} · {booking.ref}
        {booking.guestName ? ` · ${booking.guestName}` : ""}
      </span>
    </>
  );
  const box = cn("flex min-h-10 w-full items-center gap-1 rounded-lg border px-2 text-left text-xs font-medium", className);
  return onSelect ? (
    <button type="button" className={box} onClick={() => onSelect(booking.id)} aria-label={`${label} ${booking.ref}, open details`}>
      {body}
    </button>
  ) : (
    <span className={box}>{body}</span>
  );
}
