import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SlotPicker } from "@/features/booking/slot-picker";

export default function PickATimePage({ params }: PageProps<"/book/[courtId]">) {
  return (
    <PublicShell back="/book" step={2}>
      <h1 className="font-display text-ink mb-4 text-4xl uppercase">Pick a time</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <Picker params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Picker({ params }: { params: PageProps<"/book/[courtId]">["params"] }) {
  const { courtId } = await params;
  return <SlotPicker courtId={courtId} />;
}
