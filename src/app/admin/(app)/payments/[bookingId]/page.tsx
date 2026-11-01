import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentReview } from "@/features/admin/payment-review";

export default function ReviewPaymentPage({
  params,
}: PageProps<"/admin/payments/[bookingId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-[14px]" />}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({
  params,
}: {
  params: PageProps<"/admin/payments/[bookingId]">["params"];
}) {
  const { bookingId } = await params;
  return <PaymentReview id={bookingId} />;
}
