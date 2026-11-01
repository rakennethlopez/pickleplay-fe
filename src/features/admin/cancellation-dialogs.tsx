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
import { dayLabel, rangeLabel } from "@/lib/format";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { approveException, rejectException } from "./api";
import type { CancellationDetail } from "./schema";

interface DialogProps {
  request: CancellationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the server's answer once a decision has been recorded. */
  onDecided: (updated: CancellationDetail) => void;
}

function refusal(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return "Your role can't do this. Ask the business owner for access.";
  }
  if (error instanceof ApiError && error.status === 409) return `${error.message}.`;
  return "We couldn't reach the server.";
}

/** Keeps every screen that shows this request or its booking in step with the decision. */
function useSettle(request: CancellationDetail) {
  const queryClient = useQueryClient();
  return {
    settle: (updated: CancellationDetail) => {
      queryClient.setQueryData(["admin", "cancellation", request.id], updated);
      for (const key of ["cancellations", "payments", "refunds"]) {
        void queryClient.invalidateQueries({ queryKey: ["admin", key] });
      }
    },
    // A 409 means it changed under us (decided elsewhere, booking ended): show the truth.
    refresh: () => void queryClient.invalidateQueries({ queryKey: ["admin", "cancellation", request.id] }),
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate">{label}</dt>
      <dd className="text-ink text-right font-medium">{children}</dd>
    </div>
  );
}

const REFUND_CHOICES = [
  { value: "not_applicable", label: "Not applicable", hint: "No refund is owed." },
  { value: "pending", label: "Pending manual processing", hint: "Staff will handle a refund by hand, under the refund policy." },
] as const;

export function ApproveExceptionDialog({ request, open, onOpenChange, onDecided }: DialogProps) {
  const [refund, setRefund] = useState<"not_applicable" | "pending">("not_applicable");
  const [understood, setUnderstood] = useState(false);
  const { settle, refresh } = useSettle(request);
  // A refund can only be owed if money was accepted, so the option stays off until a payment was approved.
  const paid = request.paymentStatus === "approved";

  const approve = useMutation({
    mutationFn: () => approveException(request.id, { refundStatus: paid ? refund : "not_applicable", acknowledge: true }),
    onSuccess: (updated) => {
      settle(updated);
      onOpenChange(false);
      onDecided(updated);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (approve.isPending) return;
        if (!next) {
          setUnderstood(false);
          setRefund("not_applicable");
          approve.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve exception?</DialogTitle>
          <DialogDescription>
            Approving cancels this reservation. The court&apos;s hours are released only after the
            server confirms the cancellation. Nothing is refunded automatically. Refunds follow{" "}
            {REFUND_POLICY}.
          </DialogDescription>
        </DialogHeader>

        <dl className="bg-muted/50 divide-border divide-y rounded-xl px-3 text-sm">
          <Row label="Request · booking">
            {request.ref} · {request.bookingRef}
          </Row>
          <Row label="Reservation">
            {request.court.name} · {dayLabel(request.startsAt)}
          </Row>
          <Row label="Time">{rangeLabel(request.startsAt, request.endsAt)}</Row>
        </dl>

        <fieldset className="flex flex-col gap-2" disabled={approve.isPending}>
          <legend className="text-ink mb-1 text-sm font-semibold">
            Refund status · recorded separately
          </legend>
          {REFUND_CHOICES.map((c) => {
            const disabled = c.value === "pending" && !paid;
            const checked = (paid ? refund : "not_applicable") === c.value;
            return (
              <label
                key={c.value}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-sm",
                  checked ? "border-court-green bg-mist border-2" : "border-border bg-card",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="refund"
                    value={c.value}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => setRefund(c.value)}
                    className="accent-court-green size-4"
                  />
                  <span className="text-ink font-medium">{c.label}</span>
                </span>
                <span className="text-slate ml-7 text-xs">
                  {disabled ? "No payment was accepted yet, so nothing is owed." : c.hint}
                </span>
              </label>
            );
          })}
          <p className="text-slate text-xs">
            Set to &quot;Processed&quot; later on the Refunds page, only after staff have handled any
            refund themselves.
          </p>
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={understood}
            onCheckedChange={(v) => setUnderstood(v === true)}
            disabled={approve.isPending}
            className="mt-0.5"
          />
          <span className="text-ink">
            I understand this cancels the booking and does not issue a refund by itself.
          </span>
        </label>

        {approve.isPending ? (
          <p role="status" className="text-slate text-sm">
            Waiting for the server. Buttons are off so it can&apos;t be sent twice. The booking still
            shows as booked and the hours are still taken.
          </p>
        ) : null}
        {approve.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            <strong>Not cancelled.</strong> {refusal(approve.error)} The booking is still active and
            the hours are still held. Try again, or contact the customer at {CONTACT}.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approve.isPending}>
            Back
          </Button>
          <Button variant="destructive" onClick={() => approve.mutate()} disabled={!understood || approve.isPending}>
            {approve.isPending ? "Saving…" : "Cancel the booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectExceptionDialog({ request, open, onOpenChange, onDecided }: DialogProps) {
  const [explanation, setExplanation] = useState("");
  const [note, setNote] = useState("");
  const { settle, refresh } = useSettle(request);

  const reject = useMutation({
    mutationFn: () =>
      rejectException(request.id, { explanation: explanation.trim(), note: note.trim() || undefined }),
    onSuccess: (updated) => {
      settle(updated);
      onOpenChange(false);
      onDecided(updated);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reject.isPending) return;
        if (!next) {
          setExplanation("");
          setNote("");
          reject.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject exception?</DialogTitle>
          <DialogDescription>
            {request.ref} · {request.court.name} · {dayLabel(request.startsAt)}, {rangeLabel(request.startsAt, request.endsAt)}
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink font-semibold">Explanation for the customer (required)</span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={reject.isPending}
            className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring rounded-xl border p-3 text-sm outline-none focus-visible:ring-3"
          />
          <span className="text-slate text-xs">The customer sees this on their booking page.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink font-semibold">Internal note (optional, staff only)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            disabled={reject.isPending}
            className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring rounded-xl border p-3 text-sm outline-none focus-visible:ring-3"
          />
        </label>

        <p className="text-slate text-xs">
          The reservation stays active. The original booking and payment records are not changed.
          The decision stays in the audit history.
        </p>

        {reject.isPending ? (
          <p role="status" className="text-slate text-sm">
            Waiting for the server. Nothing is shown as rejected yet.
          </p>
        ) : null}
        {reject.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            <strong>Not rejected.</strong> {refusal(reject.error)} Nothing was recorded.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => reject.mutate()}
            disabled={explanation.trim().length < 3 || reject.isPending}
          >
            {reject.isPending ? "Saving…" : "Reject exception"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
