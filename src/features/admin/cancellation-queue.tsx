"use client";

import { Search, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, pesos, rangeLabel, spanLabel, timeLabel } from "@/lib/format";
import { CONTACT, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { useSignedOutRedirect } from "./admin-shell";
import { ApproveExceptionDialog, RejectExceptionDialog } from "./cancellation-dialogs";
import { Chip, humanize, METHOD } from "./payment-bits";
import { useAdminMe, useCan, useCancellation, useCancellations } from "./queries";
import type { CancellationDetail, CancellationFilter, CancellationItem } from "./schema";

const FILTERS: { value: CancellationFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-4">
      <p className="text-slate text-sm">{label}</p>
      <p className="font-display text-ink text-4xl">{value}</p>
    </div>
  );
}

/** "Starts in 11 h 20 min", or that it already started. */
function startsLabel(minutes: number) {
  return minutes <= 0 ? "Already started" : `Starts in ${spanLabel(minutes)}`;
}

export function CancellationQueue() {
  const [filter, setFilter] = useState<CancellationFilter>("pending");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Said at the top of the screen, not inside the panel: a request that was just decided leaves the
  // "Pending" list, and the confirmation must not disappear with it.
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

  const list = useCancellations(filter, q);
  const out = useSignedOutRedirect(list.error);

  // The first request is selected until the reviewer picks one. A request that was just decided
  // stays selected even though it is no longer in this list, so its outcome stays on screen.
  const items = list.data?.items ?? [];
  const activeId = selectedId ?? items[0]?.id ?? null;
  const detail = useCancellation(activeId);
  useSignedOutRedirect(detail.error);
  if (out) return null;

  const summary = list.data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-ink text-4xl uppercase">Late cancellation requests</h1>
        <p className="text-slate max-w-3xl text-sm">
          Customers asking for an exception inside the 24-hour cutoff. Philippine time. Sending a
          request does not cancel anything: the booking stays active until an administrator decides.
        </p>
      </header>

      {notice ? (
        <p role="status" className="bg-mist text-court-green border-court-green rounded-xl border p-3 text-sm font-medium">
          {notice}
        </p>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-3 gap-3">
        <Kpi label="Pending" value={summary?.pending ?? "–"} />
        <Kpi label="Approved" value={summary?.approved ?? "–"} />
        <Kpi label="Rejected" value={summary?.rejected ?? "–"} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Show" className="flex gap-2">
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
                filter === f.value
                  ? "bg-court-green text-primary-foreground border-court-green"
                  : "bg-card text-ink border-border",
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
            placeholder="Request, booking or name"
            aria-label="Search requests"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-slate text-sm">
            Loading requests…
          </p>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[14px]" />
          ))}
        </div>
      ) : list.isError ? (
        <div role="alert" className="bg-card border-clay flex flex-col gap-3 rounded-[14px] border p-5">
          <p className="text-ink font-semibold">We couldn&apos;t load requests</p>
          <p className="text-slate text-sm">
            Nothing was approved or rejected. Your earlier decisions are unchanged. Check your
            connection and try again. Still failing? Contact {CONTACT}.
          </p>
          <Button className="self-start" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 && selectedId === null ? (
        <div className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-8 text-center">
          <p className="text-ink font-semibold">
            {q ? "No requests match these filters." : filter === "pending" ? "No requests are waiting" : `No ${filter} requests yet`}
          </p>
          <p className="text-slate text-sm">
            {q || filter !== "pending"
              ? "Try a different search or filter."
              : "Requests appear here as soon as customers send them."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="flex flex-col gap-3" aria-label="Requests">
            {items.map((item) => (
              <li key={item.id}>
                <RequestCard item={item} selected={item.id === activeId} onSelect={() => setSelectedId(item.id)} />
              </li>
            ))}
            <p className="text-slate text-xs">
              Showing {items.length} of {items.length} · soonest start first
            </p>
          </ul>

          <div className="lg:sticky lg:top-4 lg:self-start">
            {detail.isPending ? (
              <Skeleton className="h-96 rounded-[14px]" />
            ) : detail.isError ? (
              <p role="alert" className="text-clay text-sm">
                We couldn&apos;t load this request. Try again.
              </p>
            ) : (
              <RequestDetail
                request={detail.data}
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

function RequestCard({ item, selected, onSelect }: { item: CancellationItem; selected: boolean; onSelect: () => void }) {
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
        <span className="text-ink font-mono text-sm font-semibold">
          {item.ref} · {item.bookingRef}
        </span>
        <Chip tone={item.status === "pending" ? "warn" : "plain"} Icon={ShieldAlert}>
          {humanize(item.status)}
        </Chip>
      </span>
      <span className="text-ink text-sm">
        {item.guestName} <span className="text-slate">· {item.maskedPhone}</span>
      </span>
      <span className="text-slate text-sm">
        {item.court.name} · {dayLabel(item.startsAt)} · {rangeLabel(item.startsAt, item.endsAt)}
      </span>
      {item.status === "pending" ? (
        <span className="text-ink text-sm font-semibold">{startsLabel(item.startsInMinutes)}</span>
      ) : null}
      <span className="text-slate line-clamp-2 text-sm italic">&ldquo;{item.reason}&rdquo;</span>
      <span className="text-slate text-xs">
        Payment {humanize(item.paymentStatus).toLowerCase()} · Refund:{" "}
        {item.refundStatus === "not_applicable" && item.status === "pending" ? "not set yet" : humanize(item.refundStatus).toLowerCase()}
      </span>
    </button>
  );
}

function RequestDetail({ request, onDone }: { request: CancellationDetail; onDone: (message: string) => void }) {
  const canDecide = useCan("cancellations:decide");
  const me = useAdminMe().data;
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const pending = request.status === "pending";

  return (
    <section className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4" aria-label="Selected request">
      <header>
        <p className="text-slate text-xs">Request</p>
        <h2 className="font-display text-ink text-3xl uppercase">{request.ref}</h2>
      </header>

      <dl className="divide-border divide-y text-sm">
        {[
          ["Booking",`${request.bookingRef} · ${request.court.name}`],
          ["Starts in", request.startsInMinutes <= 0 ? "Already started" : spanLabel(request.startsInMinutes)],
          ["When", `${dayLabel(request.startsAt)} · ${rangeLabel(request.startsAt, request.endsAt)}`],
          ["Customer", `${request.guestName ?? ""} · ${request.maskedPhone ?? ""}`],
          ["Payment", `${humanize(request.paymentStatus)}${request.paymentMethod ? ` · ${METHOD[request.paymentMethod]}` : ""} · ${pesos(request.totalAmount) ?? TOTAL}`],
          ["Refund", humanize(request.refundStatus)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-slate">{label}</dt>
            <dd className="text-ink text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="text-slate text-xs">Customer&apos;s reason</p>
        <p className="text-ink bg-muted/50 mt-1 rounded-xl p-3 text-sm">&ldquo;{request.reason}&rdquo;</p>
      </div>

      <p className="text-slate text-xs">
        Policy: customers cancel on their own up to 24 hours before. This is an exception request.
        Refunds are handled separately. Nothing is refunded automatically.
      </p>

      {pending ? (
        canDecide === null ? (
          <p role="status" className="text-slate text-sm">
            Checking what your role can do…
          </p>
        ) : canDecide ? (
          request.bookingStatus === "confirmed" || request.bookingStatus === "pending_review" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="touch" className="flex-1" onClick={() => setApproving(true)}>
                Approve exception
              </Button>
              <Button size="touch" variant="destructive" className="flex-1" onClick={() => setRejecting(true)}>
                Reject exception
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p role="note" className="bg-amber/10 border-amber text-ink rounded-xl border p-3 text-sm">
                This booking is no longer active, so there is nothing to cancel. You can reject the
                request to close it.
              </p>
              <Button size="touch" variant="destructive" onClick={() => setRejecting(true)}>
                Reject exception
              </Button>
            </div>
          )
        ) : (
          <div role="note" className="bg-muted/50 flex gap-3 rounded-xl p-4">
            <ShieldAlert className="text-slate mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="text-ink font-semibold">You can&apos;t do this with your role</p>
              <p className="text-slate">
                Approving or rejecting needs the cancellation approver role. Your role is{" "}
                {me?.role ?? "unknown"}. Ask the business owner for access. The server blocks these
                actions even if a button is forced.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="bg-muted/50 rounded-xl p-3 text-sm">
          <p className="text-ink font-semibold">
            {request.status === "approved" ? "Approved" : "Rejected"}
            {request.decidedAt ? ` · ${dayLabel(request.decidedAt)}, ${timeLabel(request.decidedAt)}` : ""}
          </p>
          {request.explanation ? <p className="text-slate">Explanation shown to the customer: {request.explanation}</p> : null}
          {request.internalNote ? <p className="text-slate">Internal note: {request.internalNote}</p> : null}
        </div>
      )}

      <div>
        <p className="text-ink text-sm font-semibold">Audit history · read only</p>
        <ol className="mt-2 flex flex-col gap-2">
          {request.history.map((h, i) => (
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

      <ApproveExceptionDialog
        request={request}
        open={approving}
        onOpenChange={setApproving}
        onDecided={(u) =>
          onDone(`${u.bookingRef} is cancelled and ${u.court.name}, ${rangeLabel(u.startsAt, u.endsAt)} was released by the server. Refund status: ${humanize(u.refundStatus).toLowerCase()}. Logged: ${me?.displayName ?? "you"}.`)
        }
      />
      <RejectExceptionDialog
        request={request}
        open={rejecting}
        onOpenChange={setRejecting}
        onDecided={(u) => onDone(`Exception rejected. ${u.ref} is logged and ${u.bookingRef} stays active.`)}
      />
    </section>
  );
}
