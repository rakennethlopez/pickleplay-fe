"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/features/booking/api";
import { dayLabel, pesos, rangeLabel } from "@/lib/format";
import { updateRefund } from "./api";
import {
  REFUND_METHOD_LABELS,
  REFUND_METHODS,
  type RefundDetail,
  type RefundMethod,
} from "./schema";

export type RefundTarget = "pending" | "processing" | "processed" | "needs_attention" | "not_applicable";

export const REFUND_ACTIONS: Record<RefundTarget, { label: string; title: string; text: string }> = {
  processing: {
    label: "Start processing",
    title: "Start processing this refund?",
    text: "This only marks that staff are working on it. No money is sent by this action.",
  },
  processed: {
    label: "Mark processed",
    title: "Mark this refund as processed?",
    text: "This records that money was sent. Do it only after you have sent the refund yourself, and write down exactly what was sent. It can't be changed afterwards.",
  },
  needs_attention: {
    label: "Needs attention",
    title: "Flag this refund?",
    text: "Use this when something is stopping the refund, for example a wrong number. Add a note so the next person knows what to do.",
  },
  not_applicable: {
    label: "No refund owed",
    title: "Record that no refund is owed?",
    text: "Use this when the refund policy does not give a refund for this booking. You can reopen it later if that turns out to be wrong.",
  },
  pending: {
    label: "Reopen as pending",
    title: "Reopen this refund?",
    text: "It goes back to Pending manual processing so staff can handle it.",
  },
};

function refusal(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return "Your role can't do this. Ask the business owner for access.";
  if (error instanceof ApiError && (error.status === 409 || error.status === 400)) return error.message;
  return "We couldn't reach the server. Nothing was changed.";
}

interface Props {
  refund: RefundDetail;
  target: RefundTarget | null;
  onClose: () => void;
  onDone: (updated: RefundDetail) => void;
}

export function RefundActionDialog({ refund, target, onClose, onDone }: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(refund.totalAmount ?? "");
  const [method, setMethod] = useState<RefundMethod>(refund.paymentMethod ?? "gcash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => {
      if (target === "processed") {
        return updateRefund(refund.id, {
          to: "processed",
          amount: Number(amount).toFixed(2),
          method,
          reference: reference.trim(),
          note: note.trim() || undefined,
        });
      }
      return updateRefund(refund.id, { to: target!, note: note.trim() || undefined });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "refund", refund.id], updated);
      for (const key of ["refunds", "cancellations"]) {
        void queryClient.invalidateQueries({ queryKey: ["admin", key] });
      }
      onClose();
      onDone(updated);
    },
    onError: (error) => {
      // The refund moved under us (someone else changed it): show where it really stands.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "refund", refund.id] });
      }
    },
  });

  if (!target) return null;
  const action = REFUND_ACTIONS[target];
  const amountOk = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const ready = target !== "processed" || (amountOk && reference.trim().length > 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action.title}</DialogTitle>
          <DialogDescription>
            {refund.ref} · {refund.court.name} · {dayLabel(refund.startsAt)},{" "}
            {rangeLabel(refund.startsAt, refund.endsAt)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-ink text-sm">{action.text}</p>

        {target === "processed" ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink font-semibold">
                Amount refunded (₱){refund.totalAmount ? ` · booking cost ${pesos(refund.totalAmount)}` : ""}
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amount !== "" && !amountOk}
                className="h-11 rounded-xl"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink font-semibold">How it was sent</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as RefundMethod)}
                className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring h-11 rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {REFUND_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink font-semibold">Reference of the refund</span>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={100}
                className="h-11 rounded-xl"
              />
              <span className="text-slate text-xs">
                Recorded with the time and your name. The customer is not notified by this action.
              </span>
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink font-semibold">Note (optional, staff only)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            disabled={save.isPending}
            className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring rounded-xl border p-3 text-sm outline-none focus-visible:ring-3"
          />
        </label>

        {save.isPending ? (
          <p role="status" className="text-slate text-sm">
            Waiting for the server. Nothing is shown as changed yet.
          </p>
        ) : null}
        {save.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            <strong>Not saved.</strong> {refusal(save.error)}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Back
          </Button>
          <Button onClick={() => save.mutate()} disabled={!ready || save.isPending}>
            {save.isPending ? "Saving…" : action.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
