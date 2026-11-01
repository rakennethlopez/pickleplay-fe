import { Clock, Copy, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentItem } from "./schema";

export const METHOD = { gcash: "GCash", maya: "Maya" } as const;

/** "pending_review" -> "Pending review", for status words straight from the server. */
export const humanize = (value: string) => {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * How the review clock stands. Overdue payments stay pending: the label is a prompt to act, never a
 * decision. Icon and words carry the meaning, never colour alone.
 */
export function DeadlineChip({
  item,
}: {
  item: Pick<PaymentItem, "paymentStatus" | "overdue" | "overdueMinutes" | "dueSoon" | "dueInMinutes">;
}) {
  if (item.paymentStatus !== "under_review") return null;
  if (item.overdue) {
    return (
      <Chip tone="bad" Icon={TriangleAlert}>
        Overdue {item.overdueMinutes} min
      </Chip>
    );
  }
  if (item.dueSoon) {
    return (
      <Chip tone="warn" Icon={Clock}>
        Due soon · {item.dueInMinutes} min left
      </Chip>
    );
  }
  return item.dueInMinutes === null ? null : (
    <Chip tone="plain" Icon={Clock}>
      {item.dueInMinutes} min left
    </Chip>
  );
}

/** Things a reviewer should look at before deciding. */
export function FlagChips({
  item,
}: {
  item: Pick<PaymentItem, "holdConflict" | "duplicate">;
}) {
  return (
    <>
      {item.holdConflict ? (
        <Chip tone="warn" Icon={TriangleAlert}>
          Hold conflict
        </Chip>
      ) : null}
      {item.duplicate ? (
        <Chip tone="bad" Icon={Copy}>
          Duplicate receipt
        </Chip>
      ) : null}
    </>
  );
}

const TONES = {
  bad: "bg-clay/10 text-clay",
  warn: "bg-amber/10 text-amber",
  plain: "bg-muted text-slate",
} as const;

export function Chip({
  tone,
  Icon,
  children,
}: {
  tone: keyof typeof TONES;
  Icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}
