"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, rangeLabel } from "@/lib/format";
import { useSignedOutRedirect } from "./admin-shell";
import { Kpi, LoadFailed, PageHeader } from "./admin-ui";
import { useOverview } from "./config-queries";
import { DayGrid } from "./day-grid";
import { humanize } from "./payment-bits";
import { useCan } from "./queries";

export function OverviewScreen() {
  const overview = useOverview();
  const out = useSignedOutRedirect(overview.error);
  const canPayments = useCan("payments:read");
  const canCancellations = useCan("cancellations:read");
  const canRefunds = useCan("refunds:read");
  if (out) return null;

  const o = overview.data;
  const k = o?.kpis;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview">
        What needs a person today, and how the courts look right now. This page refreshes on its own.
      </PageHeader>

      {overview.isPending ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-slate text-sm">
            Loading the overview…
          </p>
          <Skeleton className="h-24 rounded-[14px]" />
          <Skeleton className="h-64 rounded-[14px]" />
        </div>
      ) : overview.isError ? (
        <LoadFailed what="the overview" onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <section aria-label="What needs attention" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Awaiting review" value={k!.awaitingReview} note="Payments to check" href={canPayments ? "/admin/payments" : undefined} />
            <Kpi
              label="Overdue"
              value={k!.overdue}
              note="Past the review target; still pending"
              href={canPayments ? "/admin/payments" : undefined}
            />
            <Kpi
              label="Cancellation requests"
              value={k!.cancellationRequests}
              note="Waiting for a decision"
              href={canCancellations ? "/admin/cancellations" : undefined}
            />
            <Kpi label="Refunds to do" value={k!.openRefunds} note="Pending, processing or flagged" href={canRefunds ? "/admin/refunds" : undefined} />
            <Kpi label="Bookings today" value={k!.bookingsToday} note="Booked or under review" />
          </section>

          <section aria-label="Next bookings" className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-semibold">Next up</h2>
            {o!.upcoming.length === 0 ? (
              <p className="text-slate text-sm">No upcoming bookings.</p>
            ) : (
              <ul className="bg-card border-border divide-border divide-y rounded-[14px] border">
                {o!.upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="text-ink">
                      <span className="font-semibold">{b.ref}</span> · {b.court} · {dayLabel(b.startsAt)}, {rangeLabel(b.startsAt, b.endsAt)}
                    </span>
                    <span className="text-slate">
                      {b.guestName ?? "Guest"} · {humanize(b.bookingStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Courts today" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-ink text-base font-semibold">Courts today · {dayLabel(o!.today)}</h2>
              <Link href="/admin/calendar" className="text-court-green text-sm font-medium underline underline-offset-4">
                Open the calendar
              </Link>
            </div>
            <DayGrid calendar={o!.timeline} />
          </section>
        </>
      )}
    </div>
  );
}
