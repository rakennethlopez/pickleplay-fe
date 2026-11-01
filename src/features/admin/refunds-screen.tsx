"use client";

import { Search, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, pesos, rangeLabel, timeLabel } from "@/lib/format";
import { CONTACT, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { useSignedOutRedirect } from "./admin-shell";
import { Chip, humanize, METHOD } from "./payment-bits";
import { useAdminMe, useCan, useRefund, useRefunds } from "./queries";
import { REFUND_ACTIONS, RefundActionDialog, type RefundTarget } from "./refund-dialog";
import { REFUND_METHOD_LABELS, type RefundDetail, type RefundFilter, type RefundItem } from "./schema";

const FILTERS: { value: RefundFilter; label: string }[] = [
  { value: "open", label: "To do" },
  { value: "processed", label: "Processed" },
  { value: "none", label: "No refund owed" },
  { value: "all", label: "All" },
];

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-4">
      <p className="text-slate text-sm">{label}</p>
      <p className="font-display text-ink text-4xl">{value}</p>
      {note ? <p className="text-slate text-xs">{note}</p> : null}
    </div>
  );
}

/** How the confirmation reads after a step, for each status the refund can now be in. */
const DONE_PHRASE = {
  pending: "was reopened as pending",
  processing: "is now being processed",
  processed: "is marked processed",
  needs_attention: "is flagged as needing attention",
  not_applicable: "is recorded as no refund owed",
} as const;

const TONE = {
  pending: "warn",
  processing: "plain",
  needs_attention: "bad",
  processed: "plain",
  not_applicable: "plain",
} as const;

export function RefundsScreen() {
  const [filter, setFilter] = useState<RefundFilter>("open");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Said at the top of the screen, not inside the panel: a refund that was just handled leaves the
  // "To do" list, and the confirmation must not disappear with it.
  const [notice, setNotice] = useState<string | null>(null);
  const applied = useRef("");
  useEffect(() => {
    const id = setTimeout(() => {
      // Only a real change of the search starts over; the first run on load must not touch a selection.
      if (applied.current === text) return;
      applied.current = text;
      setQ(text);
      setSelectedId(null);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const list = useRefunds(filter, q);
  const out = useSignedOutRedirect(list.error);
  const items = list.data?.items ?? [];
  // Stay on the refund that was just handled even though it is no longer in this list.
  const activeId = selectedId ?? items[0]?.id ?? null;
  const detail = useRefund(activeId);
  useSignedOutRedirect(detail.error);
  if (out) return null;

  const summary = list.data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-ink text-4xl uppercase">Refunds</h1>
        <p className="text-slate max-w-3xl text-sm">
          Cancelled bookings and where their refund stands. Refunds are tracked separately from the
          cancellation, are never promised, and are never sent automatically: staff send them by
          hand and record what was sent here.
        </p>
      </header>

      {notice ? (
        <p role="status" className="bg-mist text-court-green border-court-green rounded-xl border p-3 text-sm font-medium">
          {notice}
        </p>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pending" value={summary?.pending ?? "–"} note="Waiting for staff" />
        <Kpi label="Processing" value={summary?.processing ?? "–"} />
        <Kpi label="Needs attention" value={summary?.needsAttention ?? "–"} />
        <Kpi label="Processed" value={summary?.processed ?? "–"} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value);
                setSelectedId(null);
              }}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                filter === f.value ? "bg-court-green text-primary-foreground border-court-green" : "bg-card text-ink border-border",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="text-slate pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Booking reference or name"
            aria-label="Search refunds"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-slate text-sm">
            Loading refunds…
          </p>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[14px]" />
          ))}
        </div>
      ) : list.isError ? (
        <div role="alert" className="bg-card border-clay flex flex-col gap-3 rounded-[14px] border p-5">
          <p className="text-ink font-semibold">We couldn&apos;t load refunds</p>
          <p className="text-slate text-sm">
            Nothing was changed. Check your connection and try again. Still failing? Contact {CONTACT}.
          </p>
          <Button className="self-start" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 && selectedId === null ? (
        <div className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-8 text-center">
          <p className="text-ink font-semibold">
            {q ? "No refunds match these filters." : filter === "open" ? "No refunds need attention" : "Nothing here yet"}
          </p>
          <p className="text-slate text-sm">
            {q || filter !== "open"
              ? "Try a different search or filter."
              : "When a paid booking is cancelled, its refund appears here for staff to handle."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="flex flex-col gap-3" aria-label="Refunds">
            {items.map((item) => (
              <li key={item.id}>
                <RefundCard item={item} selected={item.id === activeId} onSelect={() => setSelectedId(item.id)} />
              </li>
            ))}
          </ul>
          <div className="lg:sticky lg:top-4 lg:self-start">
            {detail.isPending ? (
              <Skeleton className="h-96 rounded-[14px]" />
            ) : detail.isError ? (
              <p role="alert" className="text-clay text-sm">
                We couldn&apos;t load this refund. Try again.
              </p>
            ) : (
              <RefundDetailPanel
                refund={detail.data}
                onDone={(message) => {
                  setSelectedId(detail.data.id);
                  setNotice(message);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RefundCard({ item, selected, onSelect }: { item: RefundItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 rounded-[14px] border p-4 text-left",
        selected ? "border-court-green bg-mist border-2" : "border-border bg-card",
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink font-mono text-sm font-semibold">{item.ref}</span>
        <Chip tone={TONE[item.refundStatus]} Icon={ShieldAlert}>
          {humanize(item.refundStatus)}
        </Chip>
      </span>
      <span className="text-ink text-sm">
        {item.guestName} <span className="text-slate">· {item.maskedPhone}</span>
      </span>
      <span className="text-slate text-sm">
        {item.court.name} · {dayLabel(item.startsAt)} · {rangeLabel(item.startsAt, item.endsAt)}
      </span>
      <span className="text-slate text-xs">
        Paid {pesos(item.totalAmount) ?? TOTAL}
        {item.paymentMethod ? ` · ${METHOD[item.paymentMethod]}` : ""} · cancelled{" "}
        {item.cancelledAt ? dayLabel(item.cancelledAt) : ""} ({item.cancelledBy === "exception" ? "exception approved" : "by the customer"})
      </span>
    </button>
  );
}

function RefundDetailPanel({ refund, onDone }: { refund: RefundDetail; onDone: (message: string) => void }) {
  const canProcess = useCan("refunds:process");
  const me = useAdminMe().data;
  const [target, setTarget] = useState<RefundTarget | null>(null);
  const done = refund.refundStatus === "processed";

  return (
    <section className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4" aria-label="Selected refund">
      <header>
        <p className="text-slate text-xs">Refund for</p>
        <h2 className="font-display text-ink text-3xl uppercase">{refund.ref}</h2>
      </header>

      <dl className="divide-border divide-y text-sm">
        {[
          ["Customer", `${refund.guestName ?? ""} · ${refund.maskedPhone ?? ""}`],
          ["Booking", `${refund.court.name} · ${dayLabel(refund.startsAt)} · ${rangeLabel(refund.startsAt, refund.endsAt)}`],
          ["Paid", `${pesos(refund.totalAmount) ?? TOTAL}${refund.paymentMethod ? ` · ${METHOD[refund.paymentMethod]}` : ""}`],
          ["Payment", humanize(refund.paymentStatus)],
          ["Refund", humanize(refund.refundStatus)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-slate">{label}</dt>
            <dd className="text-ink text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {refund.cancellationRequest ? (
        <p className="text-slate text-sm">
          Late cancellation {refund.cancellationRequest.ref}: &ldquo;{refund.cancellationRequest.reason}&rdquo;
        </p>
      ) : null}

      {refund.refund ? (
        <div className="bg-mist rounded-xl p-3 text-sm">
          <p className="text-ink font-semibold">Recorded as sent</p>
          <p className="text-ink">
            {pesos(refund.refund.amount)} · {REFUND_METHOD_LABELS[refund.refund.method]} · reference{" "}
            {refund.refund.reference}
          </p>
          <p className="text-slate">
            {dayLabel(refund.refund.processedAt)}, {timeLabel(refund.refund.processedAt)} · {refund.refund.processedByName}
          </p>
        </div>
      ) : null}

      {done ? (
        <p className="text-slate text-sm">This refund is processed. It records that money went out, so it can&apos;t be changed.</p>
      ) : canProcess === null ? (
        <p role="status" className="text-slate text-sm">
          Checking what your role can do…
        </p>
      ) : canProcess ? (
        refund.nextStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Next steps">
            {refund.nextStatuses.map((to) => (
              <Button
                key={to}
                size="touch"
                variant={to === "processing" || to === "processed" ? "default" : "outline"}
                onClick={() => setTarget(to)}
              >
                {REFUND_ACTIONS[to].label}
              </Button>
            ))}
          </div>
        ) : null
      ) : (
        <div role="note" className="bg-muted/50 flex gap-3 rounded-xl p-4">
          <ShieldAlert className="text-slate mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="text-ink font-semibold">You can&apos;t do this with your role</p>
            <p className="text-slate">
              Moving a refund needs the refund processor role. Your role is {me?.role ?? "unknown"}. Ask the
              business owner for access.
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-ink text-sm font-semibold">History · read only</p>
        <ol className="mt-2 flex flex-col gap-2">
          {refund.history.map((h, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-slate w-20 shrink-0 text-xs">{timeLabel(h.at)}</span>
              <span className="text-ink">
                {h.text}
                {h.actor ? <span className="text-slate"> · {h.actor}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <RefundActionDialog
        key={`${refund.id}-${target ?? "none"}`}
        refund={refund}
        target={target}
        onClose={() => setTarget(null)}
        onDone={(u) => onDone(`Refund for ${u.ref} ${DONE_PHRASE[u.refundStatus]}. Logged: ${me?.displayName ?? "you"}.`)}
      />
    </section>
  );
}
