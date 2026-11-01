"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, checkout, getHold } from "@/features/booking/api";
import { HoldTimer } from "@/features/booking/hold-timer";
import { useSettings } from "@/features/booking/queries";
import { HoldExpired } from "./hold-expired";
import {
  checkoutRequestSchema,
  type CheckoutRequest,
  type Hold,
} from "@/features/booking/schema";
import { dayLabel, pesos, rangeLabel } from "@/lib/format";
import { REFUND_POLICY } from "@/lib/placeholders";
import { cn } from "@/lib/utils";

const METHODS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
] as const;

export function CheckoutView({ holdId }: { holdId: string }) {
  const hold = useQuery({
    queryKey: ["hold", holdId],
    queryFn: () => getHold(holdId),
    retry: false,
    staleTime: Infinity,
  });
  const settings = useSettings();
  const queryClient = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);

  if (hold.isPending) {
    return <Skeleton className="h-96 rounded-[14px]" />;
  }
  if (hold.isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-ink text-4xl uppercase">Hold not found</h1>
        <p className="text-ink text-sm">
          We can&apos;t find that hold. Start a new booking to pick your hours.
        </p>
        <Link href="/book" className={cn(buttonVariants({ size: "touch" }))}>
          Choose a court and time
        </Link>
      </div>
    );
  }

  const expired = timedOut || hold.data.bookingStatus !== "held";
  if (expired) {
    return <HoldExpired hold={hold.data} holdMinutes={settings.data?.holdMinutes} />;
  }

  return (
    <CheckoutForm
      hold={hold.data}
      onExpired={() => {
        setTimedOut(true);
        void queryClient.invalidateQueries({ queryKey: ["hold", holdId] });
      }}
    />
  );
}

function CheckoutForm({ hold, onExpired }: { hold: Hold; onExpired: () => void }) {
  const router = useRouter();
  // Until the settings arrive, say only what is true with SMS off (the default).
  const smsEnabled = useSettings().data?.smsEnabled === true;
  const form = useForm<CheckoutRequest>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: { fullName: "", mobile: "" },
  });
  const { register, control, handleSubmit, formState } = form;

  const submit = useMutation({
    mutationFn: (values: CheckoutRequest) => checkout(hold.id, values),
    // Next: send the money and upload the receipt. The private link comes with the receipt.
    onSuccess: () => router.push(`/pay/${hold.id}`),
    onError: (error) => {
      if (error instanceof ApiError && (error.code === "hold_expired" || error.code === "hold_not_active")) {
        onExpired();
      }
    },
  });

  const total = pesos(hold.totalAmount);
  const failed = submit.isError && !(submit.error instanceof ApiError && submit.error.status === 409);

  return (
    <form
      onSubmit={handleSubmit((values) => submit.mutate(values))}
      noValidate
      className="flex flex-col gap-6"
    >
      <h1 className="font-display text-ink text-4xl uppercase">Checkout</h1>
      <HoldTimer
        expiresAt={hold.holdExpiresAt}
        onExpire={onExpired}
        label="Hours held. Time left"
      />

      <section className="bg-card border-border rounded-[14px] border p-4">
        <p className="font-display text-ink text-2xl uppercase">{hold.court.name}</p>
        <p className="text-slate text-sm">
          {dayLabel(hold.startsAt)} · {rangeLabel(hold.startsAt, hold.endsAt)} ·{" "}
          {hold.hours} {hold.hours === 1 ? "hr" : "hrs"}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-ink text-base font-semibold">Your details</h2>
        <Field data-invalid={!!formState.errors.fullName}>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            className="h-12 rounded-xl text-base"
            aria-invalid={!!formState.errors.fullName}
            {...register("fullName")}
          />
          <FieldError errors={[formState.errors.fullName]} />
        </Field>
        <Field data-invalid={!!formState.errors.mobile}>
          <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
          <Input
            id="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            className="h-12 rounded-xl text-base"
            aria-invalid={!!formState.errors.mobile}
            {...register("mobile")}
          />
          <FieldDescription>
            {smsEnabled
              ? "We text your private booking link here. No account needed."
              : "We use this to find your booking if you lose your link. No account needed."}
          </FieldDescription>
          <FieldError errors={[formState.errors.mobile]} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold" id="pay-with">
          Pay with
        </h2>
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="pay-with" className="grid grid-cols-2 gap-3">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={field.value === m.value}
                  onClick={() => field.onChange(m.value)}
                  className={cn(
                    "min-h-12 rounded-xl border text-base font-semibold",
                    field.value === m.value
                      ? "border-court-green bg-mist text-ink border-2"
                      : "border-border bg-card text-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        />
        {formState.errors.paymentMethod ? (
          <p role="alert" className="text-clay text-sm">
            {formState.errors.paymentMethod.message}
          </p>
        ) : null}
      </section>

      <section className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-4 text-sm">
        <p className="text-slate flex justify-between">
          <span>
            Court fee · {hold.hours} {hold.hours === 1 ? "hr" : "hrs"}
          </span>
          <span>{total ?? "To be confirmed"}</span>
        </p>
        <p className="text-ink flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{total ?? "To be confirmed"}</span>
        </p>
      </section>

      <Controller
        control={control}
        name="acceptCancellationPolicy"
        render={({ field }) => (
          <Field orientation="horizontal" data-invalid={!!formState.errors.acceptCancellationPolicy}>
            <Checkbox
              id="policy"
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
              aria-invalid={!!formState.errors.acceptCancellationPolicy}
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="policy" className="text-ink text-sm font-normal leading-snug">
                I agree to the cancellation policy: I can cancel myself up to 24 hours
                before, and later cancellations need an administrator&apos;s decision.
                Refunds follow {REFUND_POLICY}.
              </FieldLabel>
              <FieldError errors={[formState.errors.acceptCancellationPolicy]} />
            </div>
          </Field>
        )}
      />

      {failed ? (
        <p role="alert" className="text-clay text-sm">
          {submit.error instanceof ApiError && submit.error.status === 429
            ? "Too many tries. Please wait a moment and try again."
            : "Something went wrong. Your hours are still held. Please try again."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="touch" disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : "Continue to payment"}
        </Button>
        <p className="text-slate text-center text-xs">
          Booked only after an administrator approves your payment.
        </p>
      </div>
    </form>
  );
}
