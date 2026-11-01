import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutView } from "@/features/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Checkout · Pickleplay",
  robots: { index: false, follow: false },
};

export default function CheckoutPage({ params }: PageProps<"/checkout/[holdId]">) {
  return (
    <PublicShell step={3}>
      <Suspense fallback={<Skeleton className="h-96 rounded-[14px]" />}>
        <Checkout params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Checkout({ params }: { params: PageProps<"/checkout/[holdId]">["params"] }) {
  const { holdId } = await params;
  return <CheckoutView holdId={holdId} />;
}
