"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getBooking } from "@/features/booking/api";
import { BookingStatusView, LinkNotFound } from "./booking-status-view";

/** The private booking page. It keeps itself up to date so it is safe to close and reopen. */
export function BookingPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ["booking", token],
    queryFn: () => getBooking(token),
    refetchInterval: 10_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });

  if (booking.isPending) return <Skeleton className="h-96 rounded-[14px]" />;
  if (booking.isError) {
    if (booking.error instanceof ApiError && booking.error.status < 500) {
      return <LinkNotFound />;
    }
    return (
      <p role="alert" className="text-clay text-sm">
        We couldn&apos;t load your booking. Check your connection; this page will keep trying.
      </p>
    );
  }
  return (
    <BookingStatusView
      token={token}
      booking={booking.data}
      onHoldExpired={() => void queryClient.invalidateQueries({ queryKey: ["booking", token] })}
    />
  );
}
