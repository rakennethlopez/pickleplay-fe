"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/features/status/status-badge";
import { dayLabel, pesos, rangeLabel, timeLabel } from "@/lib/format";
import { AMOUNT, CONTACT, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { useSignedOutRedirect } from "./admin-shell";
import { DeadlineChip, FlagChips, METHOD } from "./payment-bits";
import { usePayments } from "./queries";
import { REJECTION_LABELS, type PaymentFilter, type PaymentItem } from "./schema";

const FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-4">
      <p className="text-slate text-sm">{label}</p>
      <p className="font-display text-ink text-4xl">{value}</p>
      {note ? <p className="text-slate text-xs">{note}</p> : null}
    </div>
  );
}

export function PaymentQueue() {
  const [filter, setFilter] = useState<PaymentFilter>("pending");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  const payments = usePayments(filter, q);
  const out = useSignedOutRedirect(payments.error);
  if (out) return null;

  const data = payments.data;
  const summary = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-ink text-4xl uppercase">Payment review</h1>
        <p className="text-slate max-w-3xl text-sm">
          GCash and Maya receipts waiting for an administrator. Philippine time.{" "}
          {data
            ? `Review target: ${data.reviewTargetMinutes} minutes from the receipt. Items due within ${data.alertLeadMinutes} minutes are marked Due soon. `
            : null}
          Overdue items stay pending: they are never approved, discarded or released automatically.
        </p>
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Pending payments"
          value={summary?.pending ?? "–"}
          note={summary ? `${summary.overdue} overdue · ${summary.dueSoon} due soon` : undefined}
        />
        <Kpi label="Approved today" value={summary?.approvedToday ?? "–"} />
        <Kpi label="Rejected today" value={summary?.rejectedToday ?? "–"} />
        <Kpi
          label="Total amount awaiting review"
          value={summary ? (pesos(summary.amountAwaiting) ?? AMOUNT) : "–"}
          note={summary ? `Across ${summary.pending} receipts` : undefined}
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Show" className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                filter === f.value
                  ? "bg-court-green text-primary-foreground border-court-green"
                  : "bg-card text-ink border-border",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="text-slate pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reference, name or mobile"
            aria-label="Search payments"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {payments.isPending ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-slate text-sm">
            Loading payments…
          </p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-[14px]" />
          ))}
        </div>
      ) : payments.isError ? (
        <div role="alert" className="bg-card border-clay flex flex-col gap-3 rounded-[14px] border p-5">
          <p className="text-ink font-semibold">We couldn&apos;t load payments</p>
          <p className="text-slate text-sm">
            Nothing was approved or rejected. Your earlier decisions are unchanged. Check your
            connection and try again. Still failing? Contact {CONTACT}.
          </p>
          <Button className="self-start" onClick={() => void payments.refetch()}>
            Try again
          </Button>
        </div>
      ) : payments.data.items.length === 0 ? (
        <div className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-8 text-center">
          <p className="text-ink font-semibold">
            {q
              ? "No payments match these filters."
              : filter === "pending"
                ? "No payments are waiting"
                : `No ${filter} payments yet`}
          </p>
          <p className="text-slate text-sm">
            {q || filter !== "pending"
              ? "Try a different search or filter."
              : "New receipts appear here as soon as customers send them. Nothing needs your review right now."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-card border-border hidden overflow-hidden rounded-[14px] border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Expected &amp; method</TableHead>
                  <TableHead>{filter === "pending" ? "Review deadline" : "Decision"}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="text-ink font-mono text-sm font-semibold">{item.ref}</p>
                      <p className="text-slate text-xs">
                        {item.court.name} · {dayLabel(item.startsAt)}
                      </p>
                      <p className="text-slate text-xs">
                        {rangeLabel(item.startsAt, item.endsAt)} · {item.hours}{" "}
                        {item.hours === 1 ? "hr" : "hrs"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-ink text-sm">{item.guestName}</p>
                      <p className="text-slate text-xs">{item.maskedPhone}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-ink text-sm font-semibold">{pesos(item.totalAmount) ?? TOTAL}</p>
                      <p className="text-slate text-xs">
                        {item.paymentMethod ? METHOD[item.paymentMethod] : "–"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Deadline item={item} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ReviewLink item={item} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {payments.data.items.map((item) => (
              <li key={item.id} className="bg-card border-border flex flex-col gap-2 rounded-[14px] border p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink font-mono text-sm font-semibold">{item.ref}</p>
                  <p className="text-ink text-sm font-semibold">
                    {pesos(item.totalAmount) ?? TOTAL}
                  </p>
                </div>
                <p className="text-slate text-sm">
                  {item.court.name} · {dayLabel(item.startsAt)} · {rangeLabel(item.startsAt, item.endsAt)}
                </p>
                <p className="text-ink text-sm">
                  {item.guestName} <span className="text-slate">· {item.maskedPhone}</span>
                </p>
                <Deadline item={item} />
                <ReviewLink item={item} className="w-full" />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-slate text-xs">
        A receipt is evidence for review, not proof the money arrived. Check the business GCash or
        Maya account before approving.
      </p>
    </div>
  );
}

function Deadline({ item }: { item: PaymentItem }) {
  if (item.paymentStatus !== "under_review") {
    return (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={item.paymentStatus === "approved" ? "confirmed" : "rejected"} />
        {item.decidedAt ? (
          <p className="text-slate text-xs">
            {dayLabel(item.decidedAt)}, {timeLabel(item.decidedAt)}
            {item.rejectionReason ? ` · ${REJECTION_LABELS[item.rejectionReason]}` : ""}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {item.submittedAt && item.reviewDueAt ? (
        <p className="text-slate text-xs">
          Sent {timeLabel(item.submittedAt)} · due {timeLabel(item.reviewDueAt)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <DeadlineChip item={item} />
        <FlagChips item={item} />
      </div>
      {item.overdue ? (
        <p className="text-slate text-xs">Still pending. Not auto-approved.</p>
      ) : null}
      {item.holdConflict ? (
        <p className="text-slate text-xs">Hold ended before this receipt. Slot not guaranteed.</p>
      ) : null}
    </div>
  );
}

function ReviewLink({ item, className }: { item: PaymentItem; className?: string }) {
  return (
    <Link
      href={`/admin/payments/${item.id}`}
      className={cn(buttonVariants({ size: "touch" }), "min-w-20 px-4", className)}
    >
      {item.paymentStatus === "under_review" ? "Review" : "View"}
    </Link>
  );
}
