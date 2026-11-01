"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getBooking, requestCancellation } from "@/features/booking/api";
import { useSettings } from "@/features/booking/queries";
import {
  cancellationRequestFormSchema,
  type Booking,
  type CancellationRequestForm,
} from "@/features/booking/schema";
import { LinkNotFound } from "@/features/status/booking-status-view";
import { dayLabel, rangeLabel, timeLabel } from "@/lib/format";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { CodeStep } from "./code-step";

const MAX = 500;

function Back({ token }: { token: string }) {
  return (
    <Link
      href={`/booking/${token}`}
      className={cn(buttonVariants({ variant: "outline", size: "touch" }), "w-full")}
    >
      Back to my booking
    </Link>
  );
}

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "verification_required") return "Enter the code we texted you.";
    if (error.code === "invalid_code") return "That code isn't right. Check it and try again.";
    if (error.status === 429) return "Too many tries. Please wait a moment and try again.";
    if (error.status === 409 || error.status === 400) return error.message;
  }
  return "We couldn't send your request. Nothing was changed. Please try again.";
}

/** The "Ask to cancel" screen: a request to an administrator, not a cancellation. */
export function AskToCancel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ["booking", token],
    queryFn: () => getBooking(token),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
  const [sent, setSent] = useState<Booking | null>(null);

  if (booking.isPending) return <Skeleton className="h-96 rounded-[14px]" />;
  if (booking.isError) {
    return booking.error instanceof ApiError && booking.error.status < 500 ? (
      <LinkNotFound />
    ) : (
      <p role="alert" className="text-clay text-sm">
        We couldn&apos;t load your booking. Check your connection and try again.
      </p>
    );
  }

  const b = sent ?? booking.data;
  if (sent) return <RequestSent booking={sent} token={token} />;

  if (!b.canRequestCancel) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-ink text-4xl uppercase leading-none">Ask to cancel</h1>
        <p className="text-ink text-sm">
          {b.cancellationRequest?.status === "pending"
            ? `You already asked to cancel (${b.cancellationRequest.ref}). An administrator will decide, and this page shows the decision.`
            : b.canSelfCancel
              ? "You can still cancel this booking yourself. No request is needed."
              : "This booking can't be cancelled from here. Contact us if you need help."}{" "}
          Questions? {CONTACT}
        </p>
        <Back token={token} />
      </div>
    );
  }

  return (
    <RequestForm
      booking={b}
      token={token}
      onSent={(updated) => {
        queryClient.setQueryData(["booking", token], updated);
        setSent(updated);
      }}
    />
  );
}

function RequestForm({
  booking,
  token,
  onSent,
}: {
  booking: Booking;
  token: string;
  onSent: (updated: Booking) => void;
}) {
  const form = useForm<CancellationRequestForm>({
    resolver: zodResolver(cancellationRequestFormSchema),
    defaultValues: { reason: "", code: "" },
  });
  const { register, handleSubmit, control, formState } = form;
  const reason = useWatch({ control, name: "reason" }) ?? "";
  const code = useWatch({ control, name: "code" }) ?? "";

  const send = useMutation({
    mutationFn: (values: CancellationRequestForm) => requestCancellation(token, values),
    onSuccess: onSent,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => send.mutate(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      <h1 className="font-display text-ink text-4xl uppercase leading-none">Ask to cancel</h1>

      <section className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-4">
        <p className="text-slate text-xs">Your booking</p>
        <p className="font-display text-ink text-2xl uppercase">
          {booking.court.name} · {dayLabel(booking.startsAt)}
        </p>
        <p className="text-slate text-sm">
          {rangeLabel(booking.startsAt, booking.endsAt)} · Philippine time · {booking.ref}
        </p>
      </section>

      <p className="text-ink bg-mist rounded-[14px] p-4 text-sm">
        This booking starts in less than 24 hours. Cancelling by yourself ended{" "}
        {dayLabel(booking.selfCancelUntil)}, {timeLabel(booking.selfCancelUntil)}. You can ask the
        administrator to make an exception.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="text-ink text-sm font-semibold">
          Why do you need to cancel? <span className="text-slate font-normal">Required</span>
        </label>
        <textarea
          id="reason"
          rows={4}
          maxLength={MAX}
          aria-invalid={!!formState.errors.reason}
          aria-describedby="reason-help"
          className="border-input bg-card focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-clay rounded-xl border p-3 text-base outline-none focus-visible:ring-3"
          {...register("reason")}
        />
        <p id="reason-help" className="text-slate flex justify-between text-xs">
          <span>Don&apos;t include card or account numbers.</span>
          <span>
            {reason.length} / {MAX} characters
          </span>
        </p>
        {formState.errors.reason ? (
          <p role="alert" className="text-clay text-sm">
            {formState.errors.reason.message}
          </p>
        ) : null}
      </div>

      {booking.cancelCodeRequired ? (
        <CodeStep
          token={token}
          maskedPhone={booking.maskedPhone}
          value={code}
          onChange={(value) => form.setValue("code", value)}
        />
      ) : null}

      <p className="text-slate text-sm">
        Sending this does not cancel your booking. It stays booked until the administrator decides.
        A cancellation does not guarantee a refund. Refunds follow {REFUND_POLICY}.
      </p>

      {send.isError ? (
        <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
          {messageFor(send.error)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="touch" disabled={send.isPending}>
          {send.isPending ? "Sending…" : "Send request"}
        </Button>
        <Back token={token} />
      </div>
    </form>
  );
}

/** Shown once the request is in. The booking is still active and nothing is refunded. */
function RequestSent({ booking, token }: { booking: Booking; token: string }) {
  const request = booking.cancellationRequest;
  const smsEnabled = useSettings().data?.smsEnabled === true;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-court-green text-sm font-semibold">Request sent</p>
      <h1 className="font-display text-ink text-4xl uppercase leading-none">
        We&apos;ve sent your request
      </h1>

      <dl className="bg-card border-border divide-border divide-y rounded-[14px] border px-4 text-sm">
        {[
          ["Request reference", request?.ref ?? ""],
          ["Booking", `${booking.ref} · ${booking.court.name}`],
          ["When", `${dayLabel(booking.startsAt)} · ${rangeLabel(booking.startsAt, booking.endsAt)}`],
          ["Sent", request ? `${timeLabel(request.requestedAt)} · Philippine time` : ""],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-slate">{label}</dt>
            <dd className="text-ink text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-ink text-sm">
        Your booking is still active. It is not cancelled, and no refund has been decided. Keep this
        reference and plan to play unless we tell you otherwise.
      </p>

      <ol className="text-ink flex flex-col gap-2 text-sm">
        <li>Request sent · done</li>
        <li>Administrator reviews · in progress</li>
        <li>
          {smsEnabled
            ? `Decision · we text ${booking.maskedPhone ?? "you"}, and your booking page updates on its own`
            : "Decision · shown on your booking page, which updates on its own"}
        </li>
      </ol>

      <p className="text-slate text-sm">
        Haven&apos;t heard back before your booking starts? Contact {CONTACT} with{" "}
        {request?.ref ?? "your request reference"}.
      </p>
      <Back token={token} />
    </div>
  );
}
