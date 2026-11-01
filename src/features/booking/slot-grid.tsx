"use client";

import { Ban, Check, Clock, Minus } from "lucide-react";
import { hourRangeLabel, manilaMinutes, timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicSettings, Slot, SlotStatus } from "./schema";

interface SlotGridProps {
  slots: Slot[];
  dayParts: PublicSettings["dayParts"];
  /** Selected slot starts (ISO), "Yours". */
  selected: string[];
  onToggle: (startsAt: string) => void;
}

const hhmm = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

/** Open, Yours, Held and Booked differ by label and icon, never by colour alone. */
const STATE: Record<
  SlotStatus | "yours",
  { label: string; Icon: typeof Check | null; className: string }
> = {
  open: { label: "Open", Icon: null, className: "bg-card text-ink border-border" },
  yours: {
    label: "Yours",
    Icon: Check,
    className: "bg-court-green text-primary-foreground border-court-green",
  },
  held: {
    label: "Held",
    Icon: Clock,
    className: "bg-amber/10 text-amber border-amber border-dashed",
  },
  booked: {
    label: "Booked",
    Icon: Ban,
    className: "bg-muted text-slate border-border line-through decoration-1",
  },
  // Hours the business closed on purpose (maintenance, an event): not bookable, and says so.
  blocked: {
    label: "Closed",
    Icon: Ban,
    className: "bg-muted text-slate border-border border-dashed",
  },
  past: {
    label: "Past",
    Icon: Minus,
    className: "bg-muted/50 text-slate border-border opacity-60",
  },
};

export function SlotGrid({ slots, dayParts, selected, onToggle }: SlotGridProps) {
  return (
    <div className="flex flex-col gap-6">
      {dayParts.map((part) => {
        const inPart = slots.filter((s) => {
          const m = manilaMinutes(s.startsAt);
          return m >= hhmm(part.start) && m < hhmm(part.end);
        });
        if (inPart.length === 0) return null;
        const open = inPart.filter((s) => s.status === "open").length;
        return (
          <section key={part.key} aria-label={part.label}>
            <h3 className="text-ink mb-2 flex items-baseline justify-between text-sm font-semibold">
              <span>
                {part.label} · {hourRangeLabel(part.start, part.end)}
              </span>
              <span className="text-slate text-xs font-normal">{open} open</span>
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {inPart.map((slot) => {
                const isYours = selected.includes(slot.startsAt);
                const key = isYours ? "yours" : slot.status;
                const { label, Icon, className } = STATE[key];
                const clickable = slot.status === "open";
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    disabled={!clickable}
                    aria-pressed={isYours}
                    aria-label={`${timeLabel(slot.startsAt)}, ${label.toLowerCase()}`}
                    onClick={() => onToggle(slot.startsAt)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 text-sm font-semibold",
                      "focus-visible:ring-ring focus-visible:ring-3 outline-none",
                      className,
                    )}
                  >
                    {timeLabel(slot.startsAt)}
                    {key !== "open" ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium">
                        {Icon ? <Icon className="size-3" aria-hidden /> : null}
                        {label}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
