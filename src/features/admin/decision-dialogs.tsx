"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/features/booking/api";
import { dayLabel, pesos, rangeLabel } from "@/lib/format";
import { CONTACT, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { approvePayment, rejectPayment } from "./api";
import { METHOD } from "./payment-bits";
import {
  REJECTION_LABELS,
  type PaymentDetail,
  type RejectionReason,
} from "./schema";

interface DialogProps {
  payment: PaymentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the server's answer once a decision has been recorded. */
  onDecided: (updated: PaymentDetail) => void;
}

/** Plain words for a refusal. Nothing is shown as decided unless the server says so. */
function refusalMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return "Your role can't do this. Ask the business owner for access.";
  }
  if (error instanceof ApiError && error.status === 409) {
    return `${error.message} Nothing was changed.`;
  }
  return "We couldn't reach the server. Nothing was approved or rejected. Try again.";
}

function useDecision(payment: PaymentDetail) {
  const queryClient = useQueryClient();
  return {
    settle: (updated: PaymentDetail) => {
      queryClient.setQueryData(["admin", "payment", payment.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    // A 409 means the payment changed under us (decided elsewhere, hours taken): show the truth.
    refresh: () => void queryClient.invalidateQueries({ queryKey: ["admin", "payment", payment.id] }),
  };
}

export function ApproveDialog({ payment, open, onOpenChange, onDecided }: DialogProps) {
  const [checked, setChecked] = useState(false);
  const decision = useDecision(payment);
  const method = payment.paymentMethod ? METHOD[payment.paymentMethod] : "payment";
  const amount = pesos(payment.totalAmount) ?? TOTAL;

  const approve = useMutation({
    mutationFn: () => approvePayment(payment.id),
    onSuccess: (updated) => {
      decision.settle(updated);
      onOpenChange(false);
      onDecided(updated);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) decision.refresh();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (approve.isPending) return; // buttons are off while the server works
        if (!next) {
          setChecked(false);
          approve.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve payment?</DialogTitle>
          <DialogDescription>
            Approving confirms this reservation only if the booking is still valid when the
            server checks. If it isn&apos;t, nothing is confirmed and you&apos;re told why.
            {payment.overdue
              ? ` This review is ${payment.overdueMinutes} min overdue, which does not change that.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <dl className="bg-muted/50 divide-border divide-y rounded-xl px-3 text-sm">
          <Row label="Booking">{payment.ref}</Row>
          <Row label="Reservation">
            {payment.court.name} · {dayLabel(payment.startsAt)}
          </Row>
          <Row label="Time">
            {rangeLabel(payment.startsAt, payment.endsAt)} · {payment.hours}{" "}
            {payment.hours === 1 ? "hr" : "hrs"}
          </Row>
          <Row label="Amount">
            {amount} · {method}
          </Row>
        </dl>

        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            disabled={approve.isPending}
            className="mt-0.5"
          />
          <span className="text-ink">
            I checked the business {method} account myself and confirm {amount} for{" "}
            {payment.ref} has arrived.
          </span>
        </label>
        <p className="text-slate text-xs">
          The button stays off until the box is ticked. Recorded: your name, time, action and
          payment details.
        </p>

        {approve.isPending ? (
          <p role="status" className="text-slate text-sm">
            Waiting for the server. Buttons are off so it can&apos;t be sent twice. Nothing is
            shown as approved yet.
          </p>
        ) : null}
        {approve.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            <strong>Not approved.</strong> {refusalMessage(approve.error)} Reject with a reason or
            contact the customer at {CONTACT}.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button onClick={() => approve.mutate()} disabled={!checked || approve.isPending}>
            {approve.isPending ? "Saving…" : "Approve payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({ payment, open, onOpenChange, onDecided }: DialogProps) {
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [note, setNote] = useState("");
  const decision = useDecision(payment);

  const reject = useMutation({
    mutationFn: () => rejectPayment(payment.id, { reason: reason!, note: note.trim() || undefined }),
    onSuccess: (updated) => {
      decision.settle(updated);
      onOpenChange(false);
      onDecided(updated);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) decision.refresh();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reject.isPending) return;
        if (!next) {
          setReason(null);
          setNote("");
          reject.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject payment?</DialogTitle>
          <DialogDescription>
            Rejecting releases the court hold right away (unless another valid booking or hold
            exists). The customer sees the reason you choose and that the original slot is no
            longer guaranteed. The decision stays in the audit log.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2" disabled={reject.isPending}>
          <legend className="text-ink mb-1 text-sm font-semibold">Reason (required)</legend>
          {(Object.keys(REJECTION_LABELS) as RejectionReason[]).map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm",
                reason === value ? "border-court-green bg-mist border-2" : "border-border bg-card",
              )}
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-court-green size-4"
              />
              {REJECTION_LABELS[value]}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink font-semibold">Internal note (optional, staff only)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={reject.isPending}
            className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring rounded-xl border p-3 text-sm outline-none focus-visible:ring-3"
          />
          <span className="text-slate text-xs">The customer never sees this note.</span>
        </label>

        {reject.isPending ? (
          <p role="status" className="text-slate text-sm">
            Waiting for the server. Nothing is shown as rejected or released yet.
          </p>
        ) : null}
        {reject.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            <strong>Not rejected.</strong> {refusalMessage(reject.error)}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => reject.mutate()}
            disabled={!reason || reject.isPending}
          >
            {reject.isPending ? "Saving…" : "Reject and release hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate">{label}</dt>
      <dd className="text-ink text-right font-medium">{children}</dd>
    </div>
  );
}
