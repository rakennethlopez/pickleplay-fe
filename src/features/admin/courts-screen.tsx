"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedOutRedirect } from "./admin-shell";
import { LoadFailed, Notice, PageHeader, Problem } from "./admin-ui";
import { clashesOf, createCourt, reorderCourts, updateCourt } from "./config-api";
import { useCourts } from "./config-queries";
import type { AdminCourt } from "./config-schema";
import { Chip } from "./payment-bits";
import { CircleCheck, CircleOff } from "lucide-react";

export function CourtsScreen() {
  const queryClient = useQueryClient();
  const courts = useCourts();
  const out = useSignedOutRedirect(courts.error);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");

  const refresh = (list?: AdminCourt[]) => {
    if (list) queryClient.setQueryData(["admin", "courts"], list);
    void queryClient.invalidateQueries({ queryKey: ["admin", "courts"] });
    // Guests see the court list and the grid: keep every cached view honest.
    void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  };

  const add = useMutation({
    mutationFn: () => createCourt(name.trim()),
    onSuccess: (court) => {
      setNotice(`${court.name} was added. Guests can book it now.`);
      setName("");
      refresh();
    },
  });
  const order = useMutation({
    mutationFn: reorderCourts,
    onSuccess: (list) => {
      setNotice("The order was saved. Guests see the courts in this order.");
      refresh(list);
    },
  });

  if (out) return null;
  const list = courts.data ?? [];
  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((c) => c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    order.mutate(ids);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Courts">
        The courts guests can book, in the order they see them. A court with bookings is switched off, never deleted, so its history stays.
      </PageHeader>

      {notice ? <Notice>{notice}</Notice> : null}

      <form
        className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-ink font-medium">Add a court</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Court 6" className="h-11 rounded-xl" />
        </label>
        <Button type="submit" size="touch" disabled={add.isPending || !name.trim()}>
          {add.isPending ? "Adding…" : "Add court"}
        </Button>
      </form>
      {add.isError ? <Problem error={add.error} /> : null}
      {order.isError ? <Problem error={order.error} /> : null}

      {courts.isPending ? (
        <Skeleton className="h-48 rounded-[14px]" />
      ) : courts.isError ? (
        <LoadFailed what="the courts" onRetry={() => void courts.refetch()} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((court, i) => (
            <CourtRow
              key={court.id}
              court={court}
              first={i === 0}
              last={i === list.length - 1}
              busy={order.isPending}
              onMove={(by) => move(i, by)}
              onSaved={(text) => {
                setNotice(text);
                refresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CourtRow({
  court,
  first,
  last,
  busy,
  onMove,
  onSaved,
}: {
  court: AdminCourt;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (by: -1 | 1) => void;
  onSaved: (text: string) => void;
}) {
  const [name, setName] = useState(court.name);
  const save = useMutation({
    mutationFn: (body: { name?: string; active?: boolean }) => updateCourt(court.id, body),
    onSuccess: (updated, body) =>
      onSaved(
        body.active === false
          ? `${updated.name} is switched off. Guests can't book it.`
          : body.active === true
            ? `${updated.name} is back on. Guests can book it.`
            : `The court is now called ${updated.name}.`,
      ),
  });
  const renamed = name.trim() !== court.name && name.trim().length > 0;

  return (
    <li className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-ink font-medium">Court name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 rounded-xl" />
        </label>
        <Button variant="outline" disabled={!renamed || save.isPending} onClick={() => save.mutate({ name: name.trim() })}>
          Rename
        </Button>
        {court.active ? (
          <Chip tone="plain" Icon={CircleCheck}>
            On · guests can book it
          </Chip>
        ) : (
          <Chip tone="warn" Icon={CircleOff}>
            Off · hidden from guests
          </Chip>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate text-sm">
          {court.totalBookings} booking{court.totalBookings === 1 ? "" : "s"} in total · {court.upcomingBookings} upcoming
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon-lg" aria-label={`Move ${court.name} up`} disabled={first || busy} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label={`Move ${court.name} down`} disabled={last || busy} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ active: !court.active })}>
            {court.active ? "Switch off" : "Switch on"}
          </Button>
        </div>
      </div>
      {save.isError ? <Problem error={save.error} clashes={clashesOf(save.error)} /> : null}
    </li>
  );
}
