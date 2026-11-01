"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, dayLabel } from "@/lib/format";
import { useSignedOutRedirect } from "./admin-shell";
import { LoadFailed, PageHeader } from "./admin-ui";
import { BookingDetailPanel } from "./booking-detail";
import { useCalendar } from "./config-queries";
import { DayGrid } from "./day-grid";

export function CalendarScreen() {
  // undefined means "today, whatever the server says it is": no clock decisions in the browser.
  const [date, setDate] = useState<string | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const calendar = useCalendar(date);
  const out = useSignedOutRedirect(calendar.error);
  if (out) return null;

  const shown = calendar.data?.date;
  const go = (days: number) => {
    if (shown) setDate(addDays(shown, days));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Calendar">
        Every court, hour by hour. Held, under review and booked hours show as they are; closed hours come from Blocked hours.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-lg" aria-label="Previous day" onClick={() => go(-1)} disabled={!shown}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-ink min-w-40 text-center font-semibold" aria-live="polite">
          {shown ? dayLabel(shown) : "…"}
          {shown && shown === calendar.data?.today ? " · today" : ""}
        </p>
        <Button variant="outline" size="icon-lg" aria-label="Next day" onClick={() => go(1)} disabled={!shown}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setDate(undefined)}>
          Today
        </Button>
        <label className="text-slate ml-auto flex items-center gap-2 text-sm">
          Go to date
          <input
            type="date"
            value={shown ?? ""}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="border-border bg-card text-ink h-11 rounded-xl border px-3 text-sm"
          />
        </label>
      </div>

      {calendar.isPending ? (
        <Skeleton className="h-96 rounded-[14px]" />
      ) : calendar.isError ? (
        <LoadFailed what="the calendar" onRetry={() => void calendar.refetch()} />
      ) : (
        <DayGrid calendar={calendar.data} onSelect={setOpenId} />
      )}

      <Dialog open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking</DialogTitle>
            <DialogDescription>Read only. Decisions are made on the payment, cancellation and refund screens.</DialogDescription>
          </DialogHeader>
          {openId ? <BookingDetailPanel id={openId} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
