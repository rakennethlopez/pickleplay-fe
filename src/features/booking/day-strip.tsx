"use client";

import { addDays, dayChip, dayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DayStripProps {
  /** Manila date of today. */
  today: string;
  selected: string;
  /** Number of days shown, starting today. */
  days: number;
  onSelect: (date: string) => void;
}

export function DayStrip({ today, selected, days, onSelect }: DayStripProps) {
  return (
    <div
      role="group"
      aria-label="Choose a day"
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
    >
      {Array.from({ length: days }, (_, i) => addDays(today, i)).map((date) => {
        const [weekday, day] = dayChip(date);
        const active = date === selected;
        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            aria-label={dayLabel(date)}
            onClick={() => onSelect(date)}
            className={cn(
              "flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-sm",
              active
                ? "bg-court-green text-primary-foreground border-court-green font-semibold"
                : "bg-card text-ink border-border",
            )}
          >
            <span className="text-xs">{weekday}</span>
            <span className="text-base">{day}</span>
          </button>
        );
      })}
    </div>
  );
}
