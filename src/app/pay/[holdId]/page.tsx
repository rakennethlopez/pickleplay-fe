import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { PayView } from "@/features/payment/pay-view";

export const metadata: Metadata = {
  title: "Send payment · Pickleplay",
  robots: { index: false, follow: false },
};

export default function PayPage({ params }: PageProps<"/pay/[holdId]">) {
  return (
    <PublicShell step={3}>
      <Suspense fallback={<Skeleton className="h-96 rounded-[14px]" />}>
        <Pay params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Pay({ params }: { params: PageProps<"/pay/[holdId]">["params"] }) {
  const { holdId } = await params;
  return <PayView holdId={holdId} />;
}
