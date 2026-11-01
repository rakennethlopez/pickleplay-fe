"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSignedOutRedirect } from "./admin-shell";
import { Empty, LoadFailed, PageHeader, Pill, selectClass } from "./admin-ui";
import { BookingDetailPanel } from "./booking-detail";
import { useBookings, useCourtOptions } from "./config-queries";
import { humanize } from "./payment-bits";

const FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "pending_review", label: "Under review" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "released", label: "Released" },
  { value: "all", label: "All" },
];
const PAGE = 25;

export function BookingsScreen() {
  const [status, setStatus] = useState("upcoming");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [courtId, setCourtId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applied = useRef("");
  useEffect(() => {
    const id = setTimeout(() => {
      if (applied.current === text) return;
      applied.current = text;
      setQ(text);
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const list = useBookings({ status, q, courtId, from, to, offset });
  const out = useSignedOutRedirect(list.error);
  const courts = useCourtOptions("bookings");
  if (out) return null;

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const activeId = selectedId ?? items[0]?.id ?? null;
  const reset = (apply: () => void) => {
    apply();
    setOffset(0);
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookings">
        Every booking and hold, newest decisions included. Mobile numbers are masked here.
      </PageHeader>

      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Pill key={f.value} active={status === f.value} onClick={() => reset(() => setStatus(f.value))}>
              {f.label}
            </Pill>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="text-slate pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reference, name or court"
              aria-label="Search bookings"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          {courts.data ? (
            <select aria-label="Court" className={selectClass} value={courtId} onChange={(e) => reset(() => setCourtId(e.target.value))}>
              <option value="">All courts</option>
              {courts.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <label className="text-slate flex items-center gap-2 text-sm">
            From
            <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="border-border bg-card text-ink h-11 flex-1 rounded-xl border px-3" />
          </label>
          <label className="text-slate flex items-center gap-2 text-sm">
            To
            <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="border-border bg-card text-ink h-11 flex-1 rounded-xl border px-3" />
          </label>
        </div>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-slate text-sm">
            Loading bookings…
          </p>
          <Skeleton className="h-24 rounded-[14px]" />
        </div>
      ) : list.isError ? (
        <LoadFailed what="bookings" onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Empty>No bookings match. Try a different filter or search.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {items.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    aria-pressed={activeId === b.id}
                    className={cn(
                      "bg-card w-full rounded-[14px] border p-3 text-left text-sm",
                      activeId === b.id ? "border-court-green border-2" : "border-border",
                    )}
                  >
                    <span className="text-ink flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {b.ref} · {b.court}
                      </span>
                      <span className="text-slate">{humanize(b.bookingStatus)}</span>
                    </span>
                    <span className="text-slate block">
                      {dayLabel(b.startsAt)}, {rangeLabel(b.startsAt, b.endsAt)} · {b.guestName ?? "No name yet"} · {b.maskedPhone ?? "No number yet"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-slate" aria-live="polite">
                {offset + 1}–{offset + items.length} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  Previous
                </Button>
                <Button variant="outline" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
          {activeId ? <BookingDetailPanel key={activeId} id={activeId} /> : null}
        </div>
      )}
    </div>
  );
}
