"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Hold } from "@/features/booking/schema";
import { dayLabel, manilaDate, rangeLabel } from "@/lib/format";
import { CONTACT } from "@/lib/placeholders";
import { cn } from "@/lib/utils";

/** The hold ran out before payment finished: what was released, and the way back to the same day. */
export function HoldExpired({ hold, holdMinutes }: { hold: Hold; holdMinutes?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-clay text-sm font-semibold">Expired</p>
      <h1 className="font-display text-ink text-4xl uppercase">
        {holdMinutes ? `Your ${holdMinutes} minutes are up` : "Your hold ended"}
      </h1>
      <p className="text-ink text-sm">
        No receipt arrived in time, so we released your hours for other players. Nothing
        has been confirmed.
      </p>
      <section className="bg-card border-border rounded-[14px] border p-4 text-sm">
        <p className="text-ink font-semibold">What was released</p>
        <p className="text-slate">
          {hold.court.name} · {dayLabel(hold.startsAt)} ·{" "}
          {rangeLabel(hold.startsAt, hold.endsAt)}
        </p>
      </section>
      <p className="text-ink text-sm">
        Already sent money? Please don&apos;t pay again. Contact {CONTACT} with reference{" "}
        {hold.ref} and your receipt so we can sort it out.
      </p>
      <p className="text-slate text-sm">
        Open hours can be taken by others at any time. Check whether the same hours are
        still open, or start a new booking.
      </p>
      <Link
        href={`/book/${hold.court.id}?date=${manilaDate(hold.startsAt)}`}
        className={cn(buttonVariants({ size: "touch" }))}
      >
        Check if these hours are open
      </Link>
      <Link href="/book" className={cn(buttonVariants({ variant: "outline", size: "touch" }))}>
        Start a new booking
      </Link>
    </div>
  );
}
