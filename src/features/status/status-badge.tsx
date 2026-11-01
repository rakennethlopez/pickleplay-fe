import {
  Ban,
  CircleCheck,
  CircleX,
  Hourglass,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/features/booking/schema";

type BadgeKey =
  | "confirmed"
  | "awaiting_receipt"
  | "under_review"
  | "rejected"
  | "released"
  | "cancelled";

const BADGES: Record<BadgeKey, { label: string; Icon: LucideIcon; className: string }> = {
  confirmed: { label: "Confirmed", Icon: CircleCheck, className: "bg-mist text-court-green" },
  awaiting_receipt: { label: "Awaiting receipt", Icon: Hourglass, className: "bg-amber/10 text-amber" },
  under_review: { label: "Under review", Icon: Search, className: "bg-amber/10 text-amber" },
  rejected: { label: "Rejected", Icon: CircleX, className: "bg-clay/10 text-clay" },
  released: { label: "Released", Icon: Undo2, className: "bg-muted text-slate" },
  cancelled: { label: "Cancelled", Icon: Ban, className: "bg-muted text-slate" },
};

/** Which badge describes a booking. Separate statuses stay separate; this only picks the headline. */
export function badgeKey(b: Pick<Booking, "bookingStatus" | "paymentStatus">): BadgeKey {
  switch (b.bookingStatus) {
    case "confirmed":
      return "confirmed";
    case "pending_review":
      return "under_review";
    case "cancelled":
      return "cancelled";
    case "released":
      if (b.paymentStatus === "rejected") return "rejected";
      // A late receipt keeps the payment under review even though the hours were released.
      return b.paymentStatus === "under_review" ? "under_review" : "released";
    default:
      return "awaiting_receipt";
  }
}

export function StatusBadge({ status }: { status: BadgeKey }) {
  const { label, Icon, className } = BADGES[status];
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
