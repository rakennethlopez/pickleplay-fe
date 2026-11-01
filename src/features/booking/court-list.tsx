"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAvailability } from "./queries";

function LoadError() {
  return (
    <p role="alert" className="text-clay text-sm">
      We couldn&apos;t load court times. Check your connection and try again.
    </p>
  );
}

/** Home: the next open hour for every court today. */
export function OpenToday() {
  const { data, isPending, isError } = useAvailability();

  if (isPending) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-12 w-32 rounded-full" />
        <Skeleton className="h-12 w-32 rounded-full" />
      </div>
    );
  }
  if (isError) return <LoadError />;

  const open = data.courts.filter((c) => c.nextOpen);
  if (open.length === 0) {
    return (
      <p className="text-slate text-sm">
        Everything is booked today.{" "}
        <Link href="/book" className="text-court-green font-semibold underline">
          See other days
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {open.map((court) => (
        <li key={court.id}>
          <Link
            href={`/book/${court.id}`}
            className="bg-mist text-ink flex min-h-12 items-center rounded-full px-4 text-sm font-medium"
          >
            {court.name} · {timeLabel(court.nextOpen!)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Choose court: a list built from the API, so a sixth court just appears. */
export function CourtPicker() {
  const { data, isPending, isError } = useAvailability();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-[14px]" />
        ))}
      </div>
    );
  }
  if (isError) return <LoadError />;

  const selected = data.courts.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Court" className="flex flex-col gap-3">
        {data.courts.map((court) => {
          const checked = court.id === selectedId;
          return (
            <button
              key={court.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelectedId(court.id)}
              className={cn(
                "flex min-h-20 items-center justify-between gap-3 rounded-[14px] border p-4 text-left",
                checked
                  ? "border-court-green bg-mist border-2"
                  : "border-border bg-card",
              )}
            >
              <span>
                <span className="font-display text-ink block text-2xl uppercase">
                  {court.name}
                </span>
                <span className="text-slate text-sm">
                  {court.nextOpen
                    ? `Next open · ${timeLabel(court.nextOpen)}`
                    : "Fully booked today · see other days"}
                </span>
              </span>
              {checked ? (
                <Check className="text-court-green size-6" aria-label="Selected" />
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <Link
          href={`/book/${selected.id}`}
          className={cn(buttonVariants({ size: "touch" }), "w-full")}
        >
          Continue with {selected.name}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={cn(buttonVariants({ size: "touch" }), "w-full")}
        >
          Choose a court
        </button>
      )}
    </div>
  );
}
