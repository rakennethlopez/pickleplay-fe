"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedOutRedirect } from "./admin-shell";
import { Labeled, LoadFailed, Notice, PageHeader, Problem, selectClass } from "./admin-ui";
import { clashesOf, updateOperations, updatePricing } from "./config-api";
import { useOperations, usePricing } from "./config-queries";
import { WEEKDAYS, type Operations, type OperatingWindow, type Pricing } from "./config-schema";
import { useCan } from "./queries";

// Monday first, as a week is read in the Philippines. The API keys days with Sunday as 0.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function PricingScreen() {
  const canPricing = useCan("pricing:manage");
  const canSettings = useCan("settings:manage");
  const pricing = usePricing(canPricing === true);
  const operations = useOperations(canSettings === true);
  const out = useSignedOutRedirect(pricing.error, operations.error);
  if (out) return null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Pricing & hours">
        What guests pay, when the courts are open, where they send the money, and how long things wait. Changes apply to future bookings
        only: nothing already booked or held is changed.
      </PageHeader>

      {canPricing === false && canSettings === false ? (
        <p role="alert" className="bg-card border-border rounded-[14px] border p-5 text-sm">
          Your role can&apos;t change pricing, hours or settings. Ask the business owner for access.
        </p>
      ) : null}

      {canPricing ? (
        pricing.isPending ? (
          <Skeleton className="h-96 rounded-[14px]" />
        ) : pricing.isError ? (
          <LoadFailed what="pricing and hours" onRetry={() => void pricing.refetch()} />
        ) : (
          <PricingForm pricing={pricing.data} />
        )
      ) : null}

      {canSettings ? (
        operations.isPending ? (
          <Skeleton className="h-64 rounded-[14px]" />
        ) : operations.isError ? (
          <LoadFailed what="settings" onRetry={() => void operations.refetch()} />
        ) : (
          <OperationsForm operations={operations.data} />
        )
      ) : null}
    </div>
  );
}

/** A time of day. "24:00" (the end of the day) is a checkbox, because a time input can't hold it. */
function ClockInput({ label, value, onChange, midnight }: { label: string; value: string; onChange: (v: string) => void; midnight?: boolean }) {
  const end = value === "24:00";
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        aria-label={label}
        value={end ? "" : value}
        disabled={end}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass + " w-32"}
      />
      {midnight ? (
        <label className="text-slate flex items-center gap-1 text-xs">
          <input type="checkbox" checked={end} onChange={(e) => onChange(e.target.checked ? "24:00" : "23:00")} />
          Midnight
        </label>
      ) : null}
    </div>
  );
}

function PricingForm({ pricing }: { pricing: Pricing }) {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState(pricing.ratePerHour ?? "");
  const [slotMinutes, setSlotMinutes] = useState(pricing.slotMinutes);
  const [maxSlots, setMaxSlots] = useState(String(pricing.maxConsecutiveSlots));
  const [horizon, setHorizon] = useState(String(pricing.bookingHorizonDays));
  const [hours, setHours] = useState<Record<string, OperatingWindow[]>>(pricing.operatingHours);
  const [parts, setParts] = useState(pricing.dayParts);
  const [gcashNumber, setGcashNumber] = useState(pricing.gcashNumber ?? "");
  const [gcashName, setGcashName] = useState(pricing.gcashAccountName ?? "");
  const [mayaNumber, setMayaNumber] = useState(pricing.mayaNumber ?? "");
  const [mayaName, setMayaName] = useState(pricing.mayaAccountName ?? "");
  const [notice, setNotice] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updatePricing({
        ratePerHour: rate.trim() === "" ? null : Number(rate),
        slotMinutes,
        maxConsecutiveSlots: Number(maxSlots),
        bookingHorizonDays: Number(horizon),
        operatingHours: hours,
        dayParts: parts,
        gcashNumber: gcashNumber.trim(),
        gcashAccountName: gcashName.trim(),
        mayaNumber: mayaNumber.trim(),
        mayaAccountName: mayaName.trim(),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "pricing"], saved);
      void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
      setNotice("Saved. Guests see the new rate and hours from now on. Existing bookings are unchanged.");
    },
    onError: () => setNotice(null),
  });

  const setDay = (day: number, windows: OperatingWindow[]) => setHours({ ...hours, [String(day)]: windows });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {notice ? <Notice>{notice}</Notice> : null}

      <section aria-labelledby="rate" className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4">
        <h2 id="rate" className="text-ink text-base font-semibold">
          Rate and booking rules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labeled label="Rate per hour (₱)" hint="Leave empty until the rate is decided">
            <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="Slot length">
            <select className={selectClass} value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
              <option value={60}>1 hour</option>
              <option value={30}>30 minutes</option>
            </select>
          </Labeled>
          <Labeled label="Most slots in a row">
            <Input type="number" min={1} max={12} value={maxSlots} onChange={(e) => setMaxSlots(e.target.value)} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="Book up to (days ahead)">
            <Input type="number" min={1} max={365} value={horizon} onChange={(e) => setHorizon(e.target.value)} className="h-11 rounded-xl" />
          </Labeled>
        </div>
      </section>

      <section aria-labelledby="accounts" className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4">
        <h2 id="accounts" className="text-ink text-base font-semibold">
          Where guests send the money
        </h2>
        <p className="text-slate text-sm">Shown to a guest only when they reach the payment step. Leave empty to show the bracketed placeholder.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="GCash number">
            <Input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="GCash account name">
            <Input value={gcashName} onChange={(e) => setGcashName(e.target.value)} maxLength={80} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="Maya number">
            <Input value={mayaNumber} onChange={(e) => setMayaNumber(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="Maya account name">
            <Input value={mayaName} onChange={(e) => setMayaName(e.target.value)} maxLength={80} className="h-11 rounded-xl" />
          </Labeled>
        </div>
      </section>

      <section aria-labelledby="hours" className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4">
        <h2 id="hours" className="text-ink text-base font-semibold">
          Opening hours (Philippine time)
        </h2>
        <p className="text-slate text-sm">A day with no hours is closed. Add a second window for a break in the day.</p>
        <div className="flex flex-col gap-3">
          {DAY_ORDER.map((day) => {
            const windows = hours[String(day)] ?? [];
            return (
              <fieldset key={day} className="border-border flex flex-col gap-2 rounded-xl border p-3">
                <legend className="text-ink px-1 text-sm font-semibold">{WEEKDAYS[day]}</legend>
                {windows.length === 0 ? <p className="text-slate text-sm">Closed</p> : null}
                {windows.map((w, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3">
                    <ClockInput label={`${WEEKDAYS[day]} opens`} value={w.open} onChange={(v) => setDay(day, windows.map((x, j) => (j === i ? { ...x, open: v } : x)))} />
                    <span className="text-slate text-sm">to</span>
                    <ClockInput label={`${WEEKDAYS[day]} closes`} midnight value={w.close} onChange={(v) => setDay(day, windows.map((x, j) => (j === i ? { ...x, close: v } : x)))} />
                    <Button type="button" variant="outline" size="icon-lg" aria-label={`Remove this ${WEEKDAYS[day]} window`} onClick={() => setDay(day, windows.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="outline" onClick={() => setDay(day, [...windows, { open: "08:00", close: "22:00" }])}>
                    <Plus className="size-4" aria-hidden />
                    Add hours
                  </Button>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="parts" className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4">
        <h2 id="parts" className="text-ink text-base font-semibold">
          Parts of the day on the booking grid
        </h2>
        <p className="text-slate text-sm">Guests see the hours grouped under these names.</p>
        <div className="flex flex-col gap-3">
          {parts.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-center gap-3">
              <Input
                aria-label={`Name of ${p.key}`}
                value={p.label}
                maxLength={30}
                onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="h-11 w-44 rounded-xl"
              />
              <ClockInput label={`${p.label} starts`} value={p.start} onChange={(v) => setParts(parts.map((x, j) => (j === i ? { ...x, start: v } : x)))} />
              <span className="text-slate text-sm">to</span>
              <ClockInput label={`${p.label} ends`} midnight value={p.end} onChange={(v) => setParts(parts.map((x, j) => (j === i ? { ...x, end: v } : x)))} />
            </div>
          ))}
        </div>
      </section>

      {save.isError ? <Problem error={save.error} clashes={clashesOf(save.error)} /> : null}
      <div>
        <Button type="submit" size="touch" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save pricing and hours"}
        </Button>
      </div>
    </form>
  );
}

const OPERATION_FIELDS: { key: keyof Operations; label: string; hint: string }[] = [
  { key: "holdMinutes", label: "Hold time (minutes)", hint: "5 to 60. Only holds made after the change use it." },
  { key: "reviewTargetMinutes", label: "Review target (minutes)", hint: "How soon staff aim to review a receipt. Overdue is a flag, never a decision." },
  { key: "alertLeadMinutes", label: "Alert before review is due (minutes)", hint: "0 to 240" },
  { key: "lateReceiptGraceMinutes", label: "Late receipt grace (minutes)", hint: "A receipt this soon after a hold ended is still reviewed. 0 to 60." },
  { key: "adminLockMinutes", label: "Sign-in lock (minutes)", hint: "How long an account stays locked after 5 wrong passwords." },
  { key: "receiptUrlTtlSeconds", label: "Receipt link life (seconds)", hint: "30 to 3600. How long a receipt link works once opened." },
  { key: "maxReceiptBytes", label: "Largest receipt (bytes)", hint: "102400 to 10485760 (10 MB)." },
  { key: "receiptRetentionDays", label: "Keep receipts (days)", hint: "1 to 3650. Check this with your privacy and accounting rules." },
];

function OperationsForm({ operations }: { operations: Operations }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(OPERATION_FIELDS.map((f) => [f.key, String(operations[f.key])])),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => updateOperations(Object.fromEntries(OPERATION_FIELDS.map((f) => [f.key, Number(values[f.key])]))),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "operations"], saved);
      setNotice("Saved. New holds and reviews use these timings. Anything already running keeps the time it started with.");
    },
    onError: () => setNotice(null),
  });

  return (
    <form
      className="bg-card border-border flex flex-col gap-4 rounded-[14px] border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-ink text-base font-semibold">Timings and limits</h2>
      {notice ? <Notice>{notice}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPERATION_FIELDS.map((f) => (
          <Labeled key={f.key} label={f.label} hint={f.hint}>
            <Input
              type="number"
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="h-11 rounded-xl"
            />
          </Labeled>
        ))}
      </div>
      {save.isError ? <Problem error={save.error} /> : null}
      <div>
        <Button type="submit" size="touch" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
