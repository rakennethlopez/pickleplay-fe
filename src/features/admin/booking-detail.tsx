"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, pesos, rangeLabel, timeLabel } from "@/lib/format";
import { useSignedOutRedirect } from "./admin-shell";
import { LoadFailed } from "./admin-ui";
import { useBooking } from "./config-queries";
import { Chip, humanize, METHOD } from "./payment-bits";
import { useCan } from "./queries";
import { TOTAL } from "@/lib/placeholders";
import { Clock } from "lucide-react";

/** One booking with its five separate statuses and what happened to it. Phones stay masked. */
export function BookingDetailPanel({ id }: { id: string }) {
  const booking = useBooking(id);
  const canPayments = useCan("payments:read");
  const canRefunds = useCan("refunds:read");
  useSignedOutRedirect(booking.error);

  if (booking.isPending) return <Skeleton className="h-72 rounded-[14px]" />;
  if (booking.isError) return <LoadFailed what="this booking" onRetry={() => void booking.refetch()} />;
  const b = booking.data;

  const rows: [string, React.ReactNode][] = [
    ["Reference", b.ref],
    ["Court", b.court.name],
    ["When", `${dayLabel(b.startsAt)} · ${rangeLabel(b.startsAt, b.endsAt)} · ${b.hours} ${b.hours === 1 ? "hr" : "hrs"}`],
    ["Guest", b.guestName ?? "Not entered yet"],
    ["Mobile", b.maskedPhone ?? "Not entered yet"],
    ["Pay with", b.paymentMethod ? METHOD[b.paymentMethod] : "Not chosen yet"],
    ["Amount", pesos(b.totalAmount) ?? TOTAL],
  ];

  return (
    <section aria-label="Booking details" className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4">
      <div>
        <h2 className="font-display text-ink text-2xl uppercase">{b.ref}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip tone="plain" Icon={Clock}>
            Booking: {humanize(b.bookingStatus)}
          </Chip>
          <Chip tone={b.overdue ? "bad" : "plain"} Icon={Clock}>
            Payment: {humanize(b.paymentStatus)}
            {b.overdue ? " (overdue)" : ""}
          </Chip>
          <Chip tone="plain" Icon={Clock}>
            Cancellation: {humanize(b.cancellationStatus)}
          </Chip>
          <Chip tone="plain" Icon={Clock}>
            Refund: {humanize(b.refundStatus)}
          </Chip>
        </div>
      </div>

      <dl className="divide-border divide-y text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-slate">{label}</dt>
            <dd className="text-ink text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {b.rejectionReason ? <p className="text-ink text-sm">Payment rejected: {humanize(b.rejectionReason)}.</p> : null}
      {b.cancelledAt ? (
        <p className="text-ink text-sm">
          Cancelled {dayLabel(b.cancelledAt)}, {timeLabel(b.cancelledAt)}
          {b.cancelledBy === "exception" ? " after an administrator approved an exception." : " by the guest."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm font-medium">
        {canPayments && b.paymentStatus !== "awaiting_receipt" ? (
          <Link href={`/admin/payments/${b.id}`} className="text-court-green underline underline-offset-4">
            Open payment review
          </Link>
        ) : null}
        {canRefunds && b.refundStatus !== "not_applicable" ? (
          <Link href="/admin/refunds" className="text-court-green underline underline-offset-4">
            Go to refunds
          </Link>
        ) : null}
      </div>

      {b.cancellationRequests.length ? (
        <div>
          <h3 className="text-ink mb-1 text-sm font-semibold">Cancellation requests</h3>
          <ul className="text-ink text-sm">
            {b.cancellationRequests.map((r) => (
              <li key={r.id}>
                {r.ref} · {humanize(r.status)} · asked {dayLabel(r.requestedAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-ink mb-1 text-sm font-semibold">History</h3>
        {b.history.length === 0 ? (
          <p className="text-slate text-sm">Nothing has been decided on this booking yet.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {b.history.map((h, i) => (
              <li key={i} className="text-ink">
                <span className="text-slate">
                  {dayLabel(h.at)}, {timeLabel(h.at)} · {h.actor} ·{" "}
                </span>
                {h.text}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
