import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "@/components/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { AskToCancel } from "@/features/cancellation/ask-to-cancel";

// The URL carries a private token, so search engines must never index it.
export const metadata: Metadata = {
  title: "Ask to cancel · Pickleplay",
  robots: { index: false, follow: false },
};

export default function AskToCancelPage({
  params,
}: PageProps<"/booking/[token]/cancel">) {
  return (
    <PublicShell>
      <Suspense fallback={<Skeleton className="h-96 rounded-[14px]" />}>
        <Ask params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Ask({
  params,
}: {
  params: PageProps<"/booking/[token]/cancel">["params"];
}) {
  const { token } = await params;
  return <AskToCancel token={token} />;
}
