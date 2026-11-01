"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/features/booking/api";
import { dayLabel, pesos, rangeLabel, timeLabel } from "@/lib/format";
import { CONTACT, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { revealPhone } from "./api";
import { useSignedOutRedirect } from "./admin-shell";
import { ApproveDialog, RejectDialog } from "./decision-dialogs";
import { DeadlineChip, FlagChips, humanize, METHOD } from "./payment-bits";
import { useAdminMe, useCan, usePayment } from "./queries";
import { ReceiptViewer } from "./receipt-viewer";
import { REJECTION_LABELS } from "./schema";

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4", className)}>
      <h2 className="text-ink text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-slate">{label}</dt>
      <dd className="text-ink text-right font-medium">{children}</dd>
    </div>
  );
}

export function PaymentReview({ id }: { id: string }) {
  const payment = usePayment(id);
  const out = useSignedOutRedirect(payment.error);
  const canReview = useCan("payments:review");
  const me = useAdminMe().data;
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (out) return null;

  const back = (
    <Link href="/admin/payments" className="text-court-green inline-flex min-h-11 items-center gap-1 text-sm font-semibold">
      <ArrowLeft className="size-4" aria-hidden />
      Payment review
    </Link>
  );

  if (payment.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="status" className="text-slate text-sm">
          Loading payment…
        </p>
        <Skeleton className="h-96 rounded-[14px]" />
      </div>
    );
  }
  if (payment.isError) {
    const missing = payment.error instanceof ApiError && payment.error.status === 404;
    const forbidden = payment.error instanceof ApiError && payment.error.status === 403;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div role="alert" className="bg-card border-clay flex flex-col gap-3 rounded-[14px] border p-5">
          <p className="text-ink font-semibold">
            {missing
              ? "We can't find that payment"
              : forbidden
                ? "You can't do this with your role"
                : "We couldn't load this payment"}
          </p>
          <p className="text-slate text-sm">
            {forbidden
              ? `Your role is ${me?.role ?? "unknown"}. Ask the business owner for access.`
              : missing
                ? "It may have been removed, or the link is wrong."
                : `Nothing was approved or rejected. Check your connection and try again. Still failing? Contact ${CONTACT}.`}
          </p>
          {!missing && !forbidden ? (
            <Button className="self-start" onClick={() => void payment.refetch()}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const p = payment.data;
  const pending = p.paymentStatus === "under_review";
  const amount = pesos(p.totalAmount) ?? TOTAL;
  const method = p.paymentMethod ? METHOD[p.paymentMethod] : "payment";

  return (
    <div className="flex flex-col gap-5">
      {back}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-ink text-4xl uppercase">
          Review payment · <span className="font-mono text-3xl normal-case">{p.ref}</span>
        </h1>
        <div className="flex flex-wrap gap-1">
          <DeadlineChip item={p} />
          <FlagChips item={p} />
        </div>
      </header>

      {notice ? (
        <p role="status" className="bg-mist text-court-green border-court-green rounded-xl border p-3 text-sm font-medium">
          {notice}
        </p>
      ) : null}

      {pending && p.overdue ? (
        <p className="bg-clay/5 border-clay text-ink rounded-xl border p-3 text-sm">
          <strong>Overdue by {p.overdueMinutes} minutes.</strong> Nothing was approved, discarded
          or released automatically. The booking stays Pending review until an administrator
          decides.
        </p>
      ) : null}
      {pending && p.holdConflict ? (
        <p className="bg-amber/10 border-amber text-ink rounded-xl border p-3 text-sm">
          <strong>Hold conflict.</strong> The hold ended {p.submittedAt ? "before this receipt arrived" : ""}
          , so the hours were released and are not guaranteed. The server re-checks availability
          when you approve.
        </p>
      ) : null}
      {pending && p.duplicate ? (
        <p className="bg-clay/5 border-clay text-ink rounded-xl border p-3 text-sm">
          <strong>Duplicate receipt.</strong> This image was already submitted for another booking.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Phones stack receipt first, then details, then the buttons (they follow in the DOM order). */}
        <div className="flex flex-col gap-5">
          <ReceiptViewer payment={p} />
          <Panel title="Activity history · read only">
            <ol className="flex flex-col gap-3">
              {p.activity.map((entry, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-slate w-20 shrink-0 text-xs">{timeLabel(entry.at)}</span>
                  <span className="text-ink">
                    {entry.text}
                    {entry.actor ? <span className="text-slate"> · {entry.actor}</span> : null}
                  </span>
                </li>
              ))}
              {pending ? (
                <li className="flex gap-3 text-sm">
                  <span className="text-slate w-20 shrink-0 text-xs">Now</span>
                  <span className="text-ink">Awaiting administrator decision</span>
                </li>
              ) : null}
            </ol>
            <p className="text-slate text-xs">Nothing here can be edited.</p>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Booking">
            <dl className="divide-border divide-y">
              <Row label="Court · date">
                {p.court.name} · {dayLabel(p.startsAt)}
              </Row>
              <Row label="Start – end · duration">
                {rangeLabel(p.startsAt, p.endsAt)} · {p.hours} {p.hours === 1 ? "hr" : "hrs"}
              </Row>
              <Row label="Customer">{p.guestName}</Row>
              <Row label="Mobile">
                <PhoneReveal paymentId={p.id} masked={p.maskedPhone} />
              </Row>
            </dl>
          </Panel>

          <Panel title="Statuses · kept separate">
            <dl className="divide-border divide-y">
              <Row label="Booking">{humanize(p.statuses.booking)}</Row>
              <Row label="Payment">{humanize(p.statuses.payment)}</Row>
              <Row label="Cancellation">{humanize(p.statuses.cancellation)}</Row>
              <Row label="Refund">{humanize(p.statuses.refund)}</Row>
            </dl>
          </Panel>

          <Panel title="What to check">
            <dl className="divide-border divide-y">
              <Row label="Amount expected">{amount}</Row>
              <Row label="Method">{method}</Row>
              <Row label="Receipts on file">{p.receiptCount}</Row>
              <Row label="Same image on another booking">{p.duplicate ? "Yes. Look closely" : "Clear"}</Row>
            </dl>
            <p className="text-slate text-xs">
              A receipt or reference is not proof of payment. Before approving, confirm in the
              business {method} account that the money has arrived.
            </p>
          </Panel>

          {pending ? (
            <section className="flex flex-col gap-3" aria-label="Decision">
              {canReview === null ? (
                <p role="status" className="text-slate text-sm">
                  Checking what your role can do…
                </p>
              ) : canReview ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="touch" className="flex-1" onClick={() => setApproving(true)}>
                      Approve Payment
                    </Button>
                    <Button
                      size="touch"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setRejecting(true)}
                    >
                      Reject Payment
                    </Button>
                  </div>
                  <p className="text-slate text-xs">
                    Rejecting releases the court hold right away. Only authorized administrators can
                    use these buttons, and the server checks this on every action.
                  </p>
                </>
              ) : (
                <div role="note" className="bg-card border-border flex gap-3 rounded-[14px] border p-4">
                  <ShieldAlert className="text-slate mt-0.5 size-5 shrink-0" aria-hidden />
                  <div className="text-sm">
                    <p className="text-ink font-semibold">You can&apos;t do this with your role</p>
                    <p className="text-slate">
                      Approve and Reject need the payment approver role. Your role is{" "}
                      {me?.role ?? "unknown"}. Ask the business owner for access. The server blocks
                      these actions even if a button is forced.
                    </p>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <Panel title="Decision">
              <p className="text-ink text-sm">
                {p.paymentStatus === "approved" ? "Approved" : "Rejected"}
                {p.decidedAt ? ` · ${dayLabel(p.decidedAt)}, ${timeLabel(p.decidedAt)}` : ""}
              </p>
              {p.rejectionReason ? (
                <p className="text-slate text-sm">
                  Reason shown to the customer: {REJECTION_LABELS[p.rejectionReason]}
                </p>
              ) : null}
              {p.rejectionNote ? (
                <p className="text-slate text-sm">Internal note: {p.rejectionNote}</p>
              ) : null}
            </Panel>
          )}
        </div>
      </div>

      <ApproveDialog
        payment={p}
        open={approving}
        onOpenChange={setApproving}
        onDecided={(updated) =>
          setNotice(`Payment approved. ${updated.ref} is confirmed by the server. Logged: ${me?.displayName ?? "you"}.`)
        }
      />
      <RejectDialog
        payment={p}
        open={rejecting}
        onOpenChange={setRejecting}
        onDecided={(updated) =>
          setNotice(
            `Payment rejected. The hold on ${updated.court.name}, ${rangeLabel(updated.startsAt, updated.endsAt)} was released by the server, and the decision stays in the audit log.`,
          )
        }
      />
    </div>
  );
}

/** The full number is masked by default. Showing it is a separate, logged action. */
function PhoneReveal({ paymentId, masked }: { paymentId: string; masked: string | null }) {
  const canReveal = useCan("phones:reveal");
  const [phone, setPhone] = useState<string | null>(null);
  const reveal = useMutation({
    mutationFn: () => revealPhone(paymentId),
    onSuccess: (r) => setPhone(r.phone),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <span>{phone ?? masked}</span>
      {phone === null && canReveal ? (
        <button
          type="button"
          onClick={() => reveal.mutate()}
          disabled={reveal.isPending}
          className="text-court-green min-h-9 text-xs font-semibold underline"
        >
          Show full number · logged
        </button>
      ) : null}
      {phone !== null ? <span className="text-slate text-xs">Logged: shown to you only for now</span> : null}
      {reveal.isError ? (
        <span role="alert" className="text-clay text-xs">
          {reveal.error instanceof ApiError && reveal.error.status === 403
            ? "Your role can't reveal numbers."
            : "Couldn't show the number. Try again."}
        </span>
      ) : null}
    </div>
  );
}
