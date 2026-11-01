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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiError, cancelBooking } from "@/features/booking/api";
import type { Booking } from "@/features/booking/schema";
import { dayLabel, rangeLabel, timeLabel } from "@/lib/format";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";
import { CodeStep } from "./code-step";

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "verification_required") return "Enter the code we texted you.";
    if (error.code === "invalid_code") return "That code isn't right. Check it and try again.";
    if (error.status === 429) return "Too many tries. Please wait a moment and try again.";
    if (error.status === 409) return error.message;
  }
  return "We couldn't cancel your booking. Nothing was changed. Please try again.";
}

/** Cancelling by yourself, before the cutoff. Asks first, because it can't be undone. */
export function CancelDialog({ token, booking }: { token: string; booking: Booking }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const cancel = useMutation({
    mutationFn: () => cancelBooking(token, code),
    onSuccess: (updated) => {
      // The page shows the server's answer, not a guess.
      queryClient.setQueryData(["booking", token], updated);
      setOpen(false);
    },
    onError: (error) => {
      // The window may have just closed: show the truth rather than leave a stale button.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["booking", token] });
      }
    },
  });

  const underReview = booking.paymentStatus === "under_review";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (cancel.isPending) return;
        if (!next) {
          setCode("");
          cancel.reset();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="touch" className="w-full" />}>
        Cancel booking
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {booking.court.name} · {dayLabel(booking.startsAt)} ·{" "}
            {rangeLabel(booking.startsAt, booking.endsAt)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-ink text-sm">
          You can cancel yourself until {dayLabel(booking.selfCancelUntil)},{" "}
          {timeLabel(booking.selfCancelUntil)}. The court will be released for other players, and
          this can&apos;t be undone.
        </p>
        <p className="text-slate text-sm">
          {underReview
            ? `Your payment is still being reviewed. Cancelling ends that review. If you already sent money, contact ${CONTACT} with ${booking.ref}. `
            : null}
          A cancellation does not guarantee a refund. Refunds follow {REFUND_POLICY}.
        </p>

        {booking.cancelCodeRequired ? (
          <CodeStep token={token} maskedPhone={booking.maskedPhone} value={code} onChange={setCode} />
        ) : null}

        {cancel.isError ? (
          <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
            {messageFor(cancel.error)}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            size="touch"
            onClick={() => setOpen(false)}
            disabled={cancel.isPending}
          >
            Keep my booking
          </Button>
          <Button
            variant="destructive"
            size="touch"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending || (booking.cancelCodeRequired && code.trim().length < 4)}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
