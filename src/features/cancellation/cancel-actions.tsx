"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useSettings } from "@/features/booking/queries";
import type { Booking } from "@/features/booking/schema";
import { dayLabel, timeLabel } from "@/lib/format";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { CancelDialog } from "./cancel-dialog";

/**
 * What the guest can do about cancelling, and where a request they made stands. Which buttons show
 * comes from the server (canSelfCancel / canRequestCancel), never from the screen's own clock.
 * Without the private link (a lookup by reference + mobile) only the status is shown.
 */
export function CancelActions({ booking, token }: { booking: Booking; token?: string }) {
  const request = booking.cancellationRequest;
  const smsEnabled = useSettings().data?.smsEnabled === true;

  return (
    <div className="flex flex-col gap-3">
      {request?.status === "pending" ? (
        <section className="bg-mist border-court-green rounded-[14px] border p-4 text-sm">
          <p className="text-ink font-semibold">Cancellation requested · {request.ref}</p>
          <p className="text-ink mt-1">
            Your booking is still active. An administrator will decide.{" "}
            {smsEnabled
              ? "We'll text you the decision, and you'll see it on this page too."
              : "You'll see the decision on this page."}{" "}
            Plan to play unless it says otherwise. Haven&apos;t heard back? Contact {CONTACT} with{" "}
            {request.ref}.
          </p>
        </section>
      ) : null}

      {request?.status === "rejected" ? (
        <section className="bg-card border-border rounded-[14px] border p-4 text-sm">
          <p className="text-ink font-semibold">Your request {request.ref} was declined</p>
          {request.explanation ? <p className="text-ink mt-1">{request.explanation}</p> : null}
          <p className="text-slate mt-1">Your booking stays active. Questions? Contact {CONTACT}.</p>
        </section>
      ) : null}

      {token && booking.canSelfCancel ? (
        <>
          <CancelDialog token={token} booking={booking} />
          <p className="text-slate text-center text-xs">
            You can cancel yourself until {dayLabel(booking.selfCancelUntil)},{" "}
            {timeLabel(booking.selfCancelUntil)}. After that, ask the administrator. Refunds follow{" "}
            {REFUND_POLICY}.
          </p>
        </>
      ) : null}

      {token && booking.canRequestCancel ? (
        <div className="flex flex-col gap-2">
          <p className="text-slate text-sm">
            Cancelling by yourself ended {dayLabel(booking.selfCancelUntil)},{" "}
            {timeLabel(booking.selfCancelUntil)}. You can ask the administrator to make an exception.
          </p>
          <Link
            href={`/booking/${token}/cancel`}
            className={cn(buttonVariants({ variant: "outline", size: "touch" }), "w-full")}
          >
            Ask to cancel
          </Link>
        </div>
      ) : null}
    </div>
  );
}
