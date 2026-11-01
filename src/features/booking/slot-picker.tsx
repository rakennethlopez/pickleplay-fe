"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, pesos, rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError, createHold } from "./api";
import { DayStrip } from "./day-strip";
import { useAvailability, useSettings } from "./queries";
import { toggleSlot } from "./selection";
import { SlotGrid } from "./slot-grid";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const LEGEND = [
  { label: "Open", Icon: null, swatch: "bg-card border-border" },
  { label: "Yours", Icon: Check, swatch: "bg-court-green text-primary-foreground border-court-green" },
  { label: "Held by someone paying", Icon: Clock, swatch: "bg-amber/10 text-amber border-amber border-dashed" },
  { label: "Booked", Icon: Ban, swatch: "bg-muted text-slate border-border" },
] as const;

export function SlotPicker({ courtId }: { courtId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = useSearchParams().get("date");

  const [picked, setPicked] = useState<string | null>(
    search && DATE.test(search) ? search : null,
  );
  const [selection, setSelection] = useState<string[]>([]);
  // Slots the server refused because someone else won them (409), kept so we can suggest
  // other courts at the same time. Slots that turn Held/Booked on a refresh are detected below.
  const [lost, setLost] = useState<string[] | null>(null);

  const availability = useAvailability(picked ?? undefined);
  const settings = useSettings();

  const hold = useMutation({
    mutationFn: createHold,
    onSuccess: (created) => router.push(`/checkout/${created.id}`),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "slot_taken") {
        setLost(validSelection);
        setSelection([]);
        void queryClient.invalidateQueries({ queryKey: ["availability"] });
      }
    },
  });

  if (availability.isPending || settings.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (availability.isError || settings.isError) {
    return (
      <p role="alert" className="text-clay text-sm">
        We couldn&apos;t load court times. Check your connection and try again.
      </p>
    );
  }

  const { data } = availability;
  const config = settings.data;
  const court = data.courts.find((c) => c.id === courtId);
  if (!court) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">That court isn&apos;t available.</p>
        <Link href="/book" className={cn(buttonVariants({ size: "touch" }))}>
          Choose a court
        </Link>
      </div>
    );
  }

  // Drop anything that stopped being open since it was picked (someone else got it).
  const validSelection = selection.filter(
    (s) => court.slots.find((x) => x.startsAt === s)?.status === "open",
  );
  // Never drop a chosen hour silently: say so, whether the 409 or a refresh found it taken.
  const conflict = lost ?? (validSelection.length < selection.length ? selection : null);
  const slotMs = config.slotMinutes * 60_000;
  const start = validSelection[0];
  const end = start
    ? new Date(
        new Date(validSelection[validSelection.length - 1]).getTime() + slotMs,
      ).toISOString()
    : null;
  const hours = (validSelection.length * config.slotMinutes) / 60;
  const total =
    config.ratePerHour === null
      ? null
      : pesos((Number(config.ratePerHour) * hours).toFixed(2));

  const otherCourts = conflict
    ? data.courts.filter(
        (c) =>
          c.id !== courtId &&
          conflict.every((s) => c.slots.find((x) => x.startsAt === s)?.status === "open"),
      )
    : [];

  return (
    <div className="flex flex-col gap-6 pb-40">
      <DayStrip
        today={data.today}
        selected={data.date}
        days={Math.min(14, config.bookingHorizonDays + 1)}
        onSelect={(date) => {
          setPicked(date);
          setSelection([]);
          setLost(null);
        }}
      />

      <p className="text-slate text-sm">
        Philippine time (Asia/Manila) · up to {config.maxConsecutiveSlots} hours in a row
      </p>

      {conflict ? (
        <section
          role="alert"
          className="border-clay bg-card flex flex-col gap-3 rounded-[14px] border p-4"
        >
          <h2 className="font-display text-ink text-2xl uppercase">
            That hour was just taken
          </h2>
          <p className="text-ink text-sm">
            Someone booked it a moment before you. Nothing was charged and nothing is
            being held for you. Your court and day are kept, so pick another time.
          </p>
          {otherCourts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {otherCourts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/book/${c.id}?date=${data.date}`}
                    className={cn(buttonVariants({ variant: "outline", size: "touch" }), "w-full")}
                  >
                    Same time on {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            variant="outline"
            size="touch"
            onClick={() => {
              setLost(null);
              setSelection(validSelection);
            }}
          >
            Pick another time
          </Button>
        </section>
      ) : null}

      <SlotGrid
        slots={court.slots}
        dayParts={config.dayParts}
        selected={validSelection}
        onToggle={(startsAt) => {
          setLost(null);
          setSelection(
            toggleSlot(validSelection, startsAt, config.maxConsecutiveSlots, config.slotMinutes),
          );
        }}
      />

      <ul className="text-slate flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {LEGEND.map(({ label, Icon, swatch }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={cn("flex size-5 items-center justify-center rounded-md border", swatch)}
            >
              {Icon ? <Icon className="size-3" aria-hidden /> : null}
            </span>
            {label}
          </li>
        ))}
      </ul>

      <div className="bg-card border-border fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md flex-col gap-3 border-t p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {start && end ? (
          <p className="text-ink flex items-baseline justify-between gap-3 text-sm">
            <span>
              <span className="block font-semibold">
                {court.name} · {dayLabel(start)}
              </span>
              {rangeLabel(start, end)} · {hours} {hours === 1 ? "hour" : "hours"}
            </span>
            <span className="font-display text-xl">{total ?? "Rate to be confirmed"}</span>
          </p>
        ) : (
          <p className="text-slate text-sm">Tap the hours you want.</p>
        )}
        {hold.isError && !(hold.error instanceof ApiError && hold.error.code === "slot_taken") ? (
          <p role="alert" className="text-clay text-sm">
            {hold.error instanceof ApiError && hold.error.status === 429
              ? "Too many tries. Please wait a moment and try again."
              : "We couldn't hold those hours. Please try again."}
          </p>
        ) : null}
        <Button
          size="touch"
          disabled={!start || hold.isPending}
          onClick={() => hold.mutate({ courtId, startsAt: start, slots: validSelection.length })}
        >
          {hold.isPending ? "Holding…" : "Continue to checkout"}
        </Button>
        <p className="text-slate text-center text-xs">
          We hold these hours for {config.holdMinutes} minutes once you continue.
        </p>
      </div>
    </div>
  );
}
