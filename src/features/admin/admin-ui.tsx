"use client";

import { Ban, CircleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { dayLabel, rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { refusalText, type Clash } from "./config-api";
import { humanize } from "./payment-bits";

/** Shared bits of the admin screens that are not about payments, so each screen stays short. */

export const selectClass =
  "border-border bg-card text-ink h-11 w-full rounded-xl border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-green";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-ink text-4xl uppercase">{title}</h1>
      {children ? <p className="text-slate max-w-3xl text-sm">{children}</p> : null}
    </header>
  );
}

export function Kpi({ label, value, note, href }: { label: string; value: React.ReactNode; note?: string; href?: string }) {
  const body = (
    <>
      <p className="text-slate text-sm">{label}</p>
      <p className="font-display text-ink text-4xl">{value}</p>
      {note ? <p className="text-slate text-xs">{note}</p> : null}
    </>
  );
  const box = "bg-card border-border rounded-[14px] border p-4";
  return href ? (
    <Link href={href} className={cn(box, "hover:border-court-green block")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** Said at the top of a screen after a change, and kept there. */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="bg-mist text-court-green border-court-green rounded-xl border p-3 text-sm font-medium">
      {children}
    </p>
  );
}

export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-card border-clay flex flex-col items-start gap-3 rounded-[14px] border p-5">
      <p className="text-ink font-semibold">We couldn&apos;t load {what}</p>
      <p className="text-slate text-sm">Nothing was changed. Check your connection and try again.</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A refusal, in words, with the bookings that stand in the way when there are any. */
export function Problem({ error, clashes }: { error: unknown; clashes?: Clash[] }) {
  return (
    <div role="alert" className="border-clay bg-clay/5 flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <p className="text-ink flex items-start gap-2 font-medium">
        <CircleAlert className="text-clay mt-0.5 size-4 shrink-0" aria-hidden />
        {refusalText(error)}
      </p>
      {clashes && clashes.length ? <ClashList clashes={clashes} /> : null}
    </div>
  );
}

export function ClashList({ clashes }: { clashes: Clash[] }) {
  return (
    <ul className="flex flex-col gap-1 pl-6">
      {clashes.map((b) => (
        <li key={b.id} className="text-ink">
          <span className="font-semibold">{b.ref}</span> · {b.court} · {dayLabel(b.startsAt)}, {rangeLabel(b.startsAt, b.endsAt)} ·{" "}
          {humanize(b.status)}
          {b.guestName ? ` · ${b.guestName}` : ""}
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-slate bg-card border-border flex items-center gap-2 rounded-[14px] border border-dashed p-5 text-sm">
      <Ban className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-medium",
        active ? "bg-court-green text-primary-foreground border-court-green" : "bg-card text-ink border-border",
      )}
    >
      {children}
    </button>
  );
}

export function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink font-medium">{label}</span>
      {children}
      {hint ? <span className="text-slate text-xs">{hint}</span> : null}
    </label>
  );
}
