"use client";

import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { CancelActions } from "@/features/cancellation/cancel-actions";
import { refundNote } from "@/features/cancellation/refund-note";
import { ReplaceReceipt } from "@/features/payment/replace-receipt";
import { HoldTimer } from "@/features/booking/hold-timer";
import { useSettings } from "@/features/booking/queries";
import { REJECTION_LABELS, type Booking } from "@/features/booking/schema";
import { dayLabel, rangeLabel, timeLabel } from "@/lib/format";
import { CONTACT, REFUND_POLICY } from "@/lib/placeholders";
import { cn } from "@/lib/utils";
import { badgeKey, StatusBadge } from "./status-badge";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate">{label}</dt>
      <dd className="text-ink text-right font-medium">{children}</dd>
    </div>
  );
}

function Heading({ eyebrow, children }: { eyebrow: React.ReactNode; children: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <div>{eyebrow}</div>
      <h1 className="font-display text-ink text-4xl uppercase leading-none">{children}</h1>
    </header>
  );
}

interface BookingStatusViewProps {
  booking: Booking;
  /** Called when a hold's countdown reaches zero, so the page can refetch. */
  onHoldExpired?: () => void;
  /**
   * The private link token. Present only on the private page: it enables actions (replace
   * receipt, copy link). A lookup by reference + mobile is view-only and has none.
   */
  token?: string;
}

/** Keeps the private link handy: with SMS off, the link and Find my booking are the ways back. */
function CopyLink() {
  return (
    <div className="flex flex-col gap-1">
      <CopyButton
        value={() => window.location.href}
        label="private link"
        text="Copy my private link"
      />
      <p className="text-slate text-center text-xs">
        Save it to check back. Anyone with this link can see this booking, so keep it to yourself.
      </p>
    </div>
  );
}

/** The private status page body. Only the server's statuses are shown, never a guess. */
export function BookingStatusView({ booking, onHoldExpired, token }: BookingStatusViewProps) {
  const settings = useSettings();
  const key = badgeKey(booking);
  const badge = <StatusBadge status={key} />;

  const details = (
    <dl className="bg-card border-border divide-border divide-y rounded-[14px] border px-4">
      <Row label="Reference">{booking.ref}</Row>
      <Row label="Court">{booking.court.name}</Row>
      <Row label="When">
        {dayLabel(booking.startsAt)} · {rangeLabel(booking.startsAt, booking.endsAt)}
      </Row>
      {booking.paymentMethod ? (
        <Row label="Pay with">{booking.paymentMethod === "gcash" ? "GCash" : "Maya"}</Row>
      ) : null}
      {booking.maskedPhone ? <Row label="Mobile">{booking.maskedPhone}</Row> : null}
    </dl>
  );

  let body: React.ReactNode;
  switch (booking.bookingStatus) {
    case "held":
      body = (
        <>
          <Heading eyebrow={badge}>Hours held</Heading>
          <HoldTimer expiresAt={booking.holdExpiresAt} onExpire={onHoldExpired} />
          <p className="text-ink text-sm">
            We&apos;re holding these hours for you. You&apos;re not booked yet: a booking is
            confirmed only after an administrator approves your payment.
          </p>
          {details}
        </>
      );
      break;
    case "pending_review":
      body = (
        <>
          <Heading eyebrow={badge}>We&apos;re reviewing your receipt</Heading>
          <p className="text-ink text-sm">
            You&apos;re not booked yet. An administrator is checking your receipt. Only their
            approval confirms the booking, and we check again that the hours are still valid.
            If the payment is rejected, the hours are released and aren&apos;t guaranteed to you.
          </p>
          {details}
          <p className="text-slate text-sm">
            We aim to review within {settings.data?.reviewTargetMinutes ?? 30} minutes of your
            receipt. If it takes longer, your booking stays pending and nothing is discarded.{" "}
            {settings.data?.smsEnabled
              ? `We'll text ${booking.maskedPhone ?? "you"} with the decision, and this page updates on its own, so it's safe to close.`
              : "This page updates on its own, so it's safe to close."}
          </p>
          {token ? (
            <>
              <CopyLink />
              <ReplaceReceipt token={token} />
            </>
          ) : null}
          <CancelActions booking={booking} token={token} />
        </>
      );
      break;
    case "confirmed":
      body = (
        <>
          <Heading eyebrow={badge}>You&apos;re booked!</Heading>
          <p className="text-ink text-sm">Booking confirmed. Payment approved by an administrator.</p>
          {details}
          {token ? (
            <CancelActions booking={booking} token={token} />
          ) : (
            <>
              <CancelActions booking={booking} />
              <p className="text-slate text-sm">
                You can cancel yourself until {dayLabel(booking.selfCancelUntil)},{" "}
                {timeLabel(booking.selfCancelUntil)}. After that, ask the administrator. Refunds
                follow {REFUND_POLICY}. Open your private link to cancel.
              </p>
            </>
          )}
          {token ? <CopyLink /> : null}
        </>
      );
      break;
    case "cancelled":
      body = (
        <>
          <Heading eyebrow={badge}>Booking cancelled</Heading>
          <p className="text-ink text-sm">
            {booking.cancelledBy === "exception"
              ? "An administrator approved your cancellation request. The court was released."
              : "You cancelled this booking. The court was released."}
          </p>
          {details}
          {refundNote(booking) ? (
            <section className="bg-card border-border rounded-[14px] border p-4 text-sm">
              <p className="text-ink font-semibold">Refund</p>
              <p className="text-ink mt-1">{refundNote(booking)}</p>
            </section>
          ) : (
            <p className="text-slate text-sm">No refund applies to this booking.</p>
          )}
          <Link href="/book" className={cn(buttonVariants({ size: "touch" }))}>
            Book another time
          </Link>
        </>
      );
      break;
    default:
      body =
        booking.paymentStatus === "under_review" ? (
          // The receipt came after the hold ended. It is kept for review, but nothing is promised.
          <>
            <Heading eyebrow={badge}>We received your receipt late</Heading>
            <p className="text-ink text-sm">
              Your hold ended before your receipt arrived, so these hours were released and
              aren&apos;t guaranteed to you. An administrator will still review your payment and
              check whether the hours are free. You&apos;re not booked yet.
            </p>
            {details}
            <p className="text-slate text-sm">
              If the hours can&apos;t be given to you, we&apos;ll tell you, and refunds follow{" "}
              {REFUND_POLICY}. Questions? {CONTACT} with {booking.ref}.
            </p>
            {token ? <ReplaceReceipt token={token} /> : null}
          </>
        ) : booking.paymentStatus === "rejected" ? (
          <>
            <Heading eyebrow={badge}>We couldn&apos;t approve this payment</Heading>
            <p className="text-ink text-sm">
              An administrator checked your receipt and could not match it. Your booking is not
              confirmed. Your original hours are released and aren&apos;t guaranteed to you, so
              someone else may book them.
            </p>
            {booking.rejectionReason ? (
              <section className="bg-card border-border rounded-[14px] border p-4 text-sm">
                <p className="text-slate">Reason from the administrator</p>
                <p className="text-ink font-semibold">
                  {REJECTION_LABELS[booking.rejectionReason]}
                </p>
              </section>
            ) : null}
            {details}
            <p className="text-slate text-sm">
              Already sent money? Please don&apos;t pay again. Contact {CONTACT} with{" "}
              {booking.ref} and your receipt. Refunds follow {REFUND_POLICY}.
            </p>
            <BookAgain />
          </>
        ) : (
          <>
            <Heading eyebrow={badge}>
              {settings.data
                ? `Your ${settings.data.holdMinutes} minutes are up`
                : "Your hold ended"}
            </Heading>
            <p className="text-ink text-sm">
              No receipt arrived in time, so we released your hours for other players. Nothing
              has been confirmed.
            </p>
            {details}
            <p className="text-slate text-sm">
              Already sent money? Please don&apos;t pay again. Contact {CONTACT} with{" "}
              {booking.ref} and your receipt so we can sort it out.
            </p>
            <BookAgain />
          </>
        );
  }

  return <article className="flex flex-col gap-5">{body}</article>;
}

function BookAgain() {
  return (
    <Link href="/book" className={cn(buttonVariants({ size: "touch" }))}>
      Choose a court and time
    </Link>
  );
}

/** Shown for a wrong or cut-off link. Never says whether a booking exists. */
export function LinkNotFound() {
  return (
    <article className="flex flex-col gap-5">
      <h1 className="font-display text-ink text-4xl uppercase leading-none">
        We can&apos;t find that booking
      </h1>
      <p className="text-ink text-sm">
        The link may be cut off, mistyped or no longer active. To protect players&apos;
        privacy, we can&apos;t say whether a booking exists for it.
      </p>
      <ol className="text-ink list-decimal pl-5 text-sm">
        <li>Open your confirmation and tap the full link again.</li>
        <li>Or use Find my booking with your reference and mobile number.</li>
        <li>Still stuck? Contact {CONTACT} and have your reference ready.</li>
      </ol>
      <Link href="/find" className={cn(buttonVariants({ size: "touch" }))}>
        Find my booking
      </Link>
      <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "touch" }))}>
        Back to home
      </Link>
    </article>
  );
}
