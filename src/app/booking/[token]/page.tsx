import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingPage } from "@/features/status/booking-page";

// The URL carries a private token, so search engines must never index it.
export const metadata: Metadata = {
  title: "Your booking · Pickleplay",
  robots: { index: false, follow: false },
};

export default function BookingStatusPage({ params }: PageProps<"/booking/[token]">) {
  return (
    <PublicShell tabs="booking">
      <Suspense fallback={<Skeleton className="h-96 rounded-[14px]" />}>
        <Booking params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Booking({ params }: { params: PageProps<"/booking/[token]">["params"] }) {
  const { token } = await params;
  return <BookingPage token={token} />;
}
