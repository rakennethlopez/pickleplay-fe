"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getHold, getPayment, submitReceipt } from "@/features/booking/api";
import { HoldTimer } from "@/features/booking/hold-timer";
import { useSettings } from "@/features/booking/queries";
import type { Hold, PaymentInstructions } from "@/features/booking/schema";
import { HoldExpired } from "@/features/checkout/hold-expired";
import { dayLabel, pesos, rangeLabel } from "@/lib/format";
import { ACCOUNT_NAME, ACCOUNT_NUMBER, TOTAL } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { ReceiptPicker } from "./receipt-picker";
import { uploadFailureMessage, uploadFileMessage } from "./upload-error";

const METHOD_LABEL = { gcash: "GCash", maya: "Maya" } as const;

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-ink text-4xl uppercase">{title}</h1>
      <p className="text-ink text-sm">{children}</p>
    </div>
  );
}

export function PayView({ holdId }: { holdId: string }) {
  const hold = useQuery({
    queryKey: ["hold", holdId],
    queryFn: () => getHold(holdId),
    retry: false,
    staleTime: Infinity,
  });
  const payment = useQuery({
    queryKey: ["payment", holdId],
    queryFn: () => getPayment(holdId),
    retry: false,
    staleTime: Infinity,
  });
  const settings = useSettings();
  const queryClient = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);

  if (hold.isPending || payment.isPending) return <Skeleton className="h-96 rounded-[14px]" />;

  if (hold.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Notice title="Hold not found">
          We can&apos;t find that hold. Start a new booking to pick your hours.
        </Notice>
        <Link href="/book" className={cn(buttonVariants({ size: "touch" }))}>
          Choose a court and time
        </Link>
      </div>
    );
  }

  // Details first: the payment account depends on the method chosen at checkout.
  if (payment.isError) {
    const needsDetails = payment.error instanceof ApiError && payment.error.code === "checkout_required";
    return (
      <div className="flex flex-col gap-4">
        <Notice title={needsDetails ? "One more step" : "Something went wrong"}>
          {needsDetails
            ? "Enter your details so we know who the booking is for."
            : "We couldn't load your payment details. Check your connection and try again."}
        </Notice>
        {needsDetails ? (
          <Link href={`/checkout/${holdId}`} className={cn(buttonVariants({ size: "touch" }))}>
            Go to checkout
          </Link>
        ) : null}
      </div>
    );
  }

  const status = hold.data.bookingStatus;
  if (status === "pending_review" || status === "confirmed") {
    return (
      <div className="flex flex-col gap-4">
        <Notice title="Receipt received">
          We already have your receipt for {hold.data.ref}. Use your private booking link to
          see where it stands, or look it up with your reference and mobile number.
        </Notice>
        <Link href="/find" className={cn(buttonVariants({ size: "touch" }))}>
          Find my booking
        </Link>
      </div>
    );
  }
  if (status !== "held" || timedOut) {
    return <HoldExpired hold={hold.data} holdMinutes={settings.data?.holdMinutes} />;
  }

  return (
    <PayForm
      hold={hold.data}
      payment={payment.data}
      onExpired={() => {
        setTimedOut(true);
        void queryClient.invalidateQueries({ queryKey: ["hold", holdId] });
      }}
    />
  );
}

function PayForm({
  hold,
  payment,
  onExpired,
}: {
  hold: Hold;
  payment: PaymentInstructions;
  onExpired: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const method = METHOD_LABEL[payment.method];
  const total = pesos(payment.amount);

  const send = useMutation({
    mutationFn: (chosen: File) => submitReceipt(hold.id, chosen),
    onSuccess: ({ token }) => router.push(`/booking/${token}`),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "hold_not_active") onExpired();
    },
  });
  const fileMessage = send.isError ? uploadFileMessage(send.error, payment.maxReceiptBytes) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-ink text-4xl uppercase">Send payment</h1>
      <HoldTimer
        expiresAt={hold.holdExpiresAt}
        onExpire={onExpired}
        label="Upload your receipt before time runs out"
      />

      <section className="bg-card border-border flex flex-col gap-1 rounded-[14px] border p-4">
        <p className="text-slate text-sm">Send exactly</p>
        <p className="font-display text-court-green text-4xl">{total ?? TOTAL}</p>
        <p className="text-slate text-sm">
          {hold.court.name} · {dayLabel(hold.startsAt)} · {rangeLabel(hold.startsAt, hold.endsAt)}
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="step-send">
        <h2 id="step-send" className="text-ink text-base font-semibold">
          1 · Send it from your {method} app
        </h2>
        <Detail label="Number" value={payment.account.number} placeholder={ACCOUNT_NUMBER[payment.method]} />
        <Detail label="Account name" value={payment.account.name} placeholder={ACCOUNT_NAME} />
        <p className="text-slate text-sm">
          Add {payment.ref} in the message if the app allows.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="step-upload">
        <h2 id="step-upload" className="text-ink text-base font-semibold">
          2 · Upload your receipt
        </h2>
        <ReceiptPicker
          maxBytes={payment.maxReceiptBytes}
          file={file}
          onFile={setFile}
          disabled={send.isPending}
          serverError={fileMessage}
        />
      </section>

      {send.isError && !fileMessage && !(send.error instanceof ApiError && send.error.code === "hold_not_active") ? (
        <p role="alert" className="text-clay text-sm">
          {uploadFailureMessage(send.error)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button size="touch" disabled={!file || send.isPending} onClick={() => file && send.mutate(file)}>
          {send.isPending ? "Sending…" : "Submit receipt for review"}
        </Button>
        <p className="text-slate text-center text-xs">
          Submitting does not confirm your booking. An administrator checks it first.
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string | null;
  placeholder: string;
}) {
  return (
    <div className="bg-card border-border flex items-center justify-between gap-3 rounded-[14px] border p-3">
      <div className="min-w-0">
        <p className="text-slate text-xs">{label}</p>
        <p className={cn("text-ink text-base font-semibold break-words", !value && "text-slate")}>
          {value ?? placeholder}
        </p>
      </div>
      {value ? <CopyButton value={value} label={label.toLowerCase()} /> : null}
    </div>
  );
}
