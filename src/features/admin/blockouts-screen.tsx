"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, rangeLabel } from "@/lib/format";
import { useSignedOutRedirect } from "./admin-shell";
import { Empty, Labeled, LoadFailed, Notice, PageHeader, Pill, Problem, selectClass } from "./admin-ui";
import { clashesOf, createBlockout, removeBlockout } from "./config-api";
import { useBlockouts, useCourtOptions } from "./config-queries";
import type { Blockout } from "./config-schema";

/** A Manila wall-clock date and time as an instant. The business runs on Philippine time only. */
export const manilaInstant = (date: string, time: string) => `${date}T${time}:00+08:00`;

export function BlockoutsScreen() {
  const queryClient = useQueryClient();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const blockouts = useBlockouts(when);
  const courts = useCourtOptions("blockouts");
  const out = useSignedOutRedirect(blockouts.error);
  const [notice, setNotice] = useState<string | null>(null);

  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [reason, setReason] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "blockouts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  };

  const add = useMutation({
    mutationFn: () =>
      createBlockout({
        courtId: courtId || null,
        startsAt: manilaInstant(date, start),
        endsAt: manilaInstant(date, end),
        reason: reason.trim(),
      }),
    onSuccess: (created) => {
      setNotice(`Closed ${created.court?.name ?? "all courts"} on ${dayLabel(created.startsAt)}, ${rangeLabel(created.startsAt, created.endsAt)}. Guests can't book those hours.`);
      setReason("");
      refresh();
    },
  });

  if (out) return null;
  const ready = date !== "" && start !== "" && end !== "" && end > start && reason.trim().length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Blocked hours">
        Close hours for maintenance, an event or a holiday. Guests see them as closed. Hours that already have a booking can&apos;t be closed:
        deal with those bookings first.
      </PageHeader>

      {notice ? <Notice>{notice}</Notice> : null}

      <form
        className="bg-card border-border grid gap-3 rounded-[14px] border p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) add.mutate();
        }}
      >
        <Labeled label="Court">
          <select className={selectClass} value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value="">All courts</option>
            {(courts.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={selectClass} />
        </Labeled>
        <Labeled label="From">
          <input type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} className={selectClass} />
        </Labeled>
        <Labeled label="Until" hint="Within one day">
          <input type="time" step={1800} value={end} onChange={(e) => setEnd(e.target.value)} className={selectClass} />
        </Labeled>
        <Labeled label="Reason" hint="Shown to staff only">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="h-11 rounded-xl" />
        </Labeled>
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="touch" disabled={!ready || add.isPending}>
            {add.isPending ? "Closing…" : "Close these hours"}
          </Button>
        </div>
      </form>
      {add.isError ? <Problem error={add.error} clashes={clashesOf(add.error)} /> : null}

      <div role="group" aria-label="Show" className="flex gap-2">
        <Pill active={when === "upcoming"} onClick={() => setWhen("upcoming")}>
          Upcoming
        </Pill>
        <Pill active={when === "past"} onClick={() => setWhen("past")}>
          Past
        </Pill>
      </div>

      {blockouts.isPending ? (
        <Skeleton className="h-32 rounded-[14px]" />
      ) : blockouts.isError ? (
        <LoadFailed what="blocked hours" onRetry={() => void blockouts.refetch()} />
      ) : blockouts.data.items.length === 0 ? (
        <Empty>{when === "upcoming" ? "No hours are closed right now." : "Nothing was closed before."}</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {blockouts.data.items.map((b) => (
            <BlockoutRow
              key={b.id}
              blockout={b}
              onReopened={() => {
                setNotice("The hours are open again. Guests can book them.");
                refresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockoutRow({ blockout: b, onReopened }: { blockout: Blockout; onReopened: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({ mutationFn: () => removeBlockout(b.id), onSuccess: onReopened });
  return (
    <li className="bg-card border-border flex flex-col gap-2 rounded-[14px] border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink">
          <span className="font-semibold">{b.court?.name ?? "All courts"}</span> · {dayLabel(b.startsAt)}, {rangeLabel(b.startsAt, b.endsAt)}
          <span className="text-slate block">
            {b.reason} · set by {b.createdByName}
          </span>
        </p>
        {confirming ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={remove.isPending}>
              Keep it closed
            </Button>
            <Button onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Reopening…" : "Yes, reopen"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Reopen hours
          </Button>
        )}
      </div>
      {remove.isError ? <Problem error={remove.error} /> : null}
    </li>
  );
}
