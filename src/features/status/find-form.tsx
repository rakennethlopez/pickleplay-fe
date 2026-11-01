"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, findBooking } from "@/features/booking/api";
import { findRequestSchema, type FindRequest } from "@/features/booking/schema";
import { CONTACT } from "@/lib/placeholders";
import { BookingStatusView } from "./booking-status-view";

/** Reference + mobile fallback. It shows the booking here; it never issues a link or an action. */
export function FindForm() {
  const form = useForm<FindRequest>({
    resolver: zodResolver(findRequestSchema),
    defaultValues: { reference: "", mobile: "" },
  });
  const { register, handleSubmit, formState } = form;
  const find = useMutation({ mutationFn: findBooking });

  if (find.isSuccess) return <BookingStatusView booking={find.data} />;

  const message =
    find.error instanceof ApiError && find.error.status === 429
      ? "Too many tries. Lookups pause for a short while. Please try again later."
      : find.error instanceof ApiError && find.error.status === 404
        ? "We couldn't match those details. Check the reference and mobile number, then try again."
        : find.isError
          ? "Something went wrong. Please try again."
          : null;

  return (
    <form
      onSubmit={handleSubmit((values) => find.mutate(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      <h1 className="font-display text-ink text-4xl uppercase leading-none">Find my booking</h1>
      <p className="text-ink text-sm">
        Enter the reference from your confirmation and the mobile number you booked with. Both
        must match.
      </p>

      {message ? (
        <p role="alert" className="text-clay bg-card border-clay rounded-xl border p-3 text-sm">
          {message}
        </p>
      ) : null}

      <Field data-invalid={!!formState.errors.reference}>
        <FieldLabel htmlFor="reference">Booking reference</FieldLabel>
        <Input
          id="reference"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="PP-7K2M9Q"
          className="h-12 rounded-xl text-base uppercase"
          aria-invalid={!!formState.errors.reference}
          {...register("reference")}
        />
        <FieldDescription>Starts with PP-. It&apos;s in your confirmation.</FieldDescription>
        <FieldError errors={[formState.errors.reference]} />
      </Field>

      <Field data-invalid={!!formState.errors.mobile}>
        <FieldLabel htmlFor="mobile">Mobile number used to book</FieldLabel>
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
        <FieldError errors={[formState.errors.mobile]} />
      </Field>

      <p className="text-slate text-sm">
        Can&apos;t find your reference? Contact {CONTACT}. To protect your privacy, we
        won&apos;t show personal details here, and lookups pause after several tries.
      </p>

      <Button type="submit" size="touch" disabled={find.isPending}>
        {find.isPending ? "Looking…" : "Find booking"}
      </Button>
      <p className="text-slate text-center text-sm">
        Have your private link? Open it from your confirmation instead.
      </p>
    </form>
  );
}
