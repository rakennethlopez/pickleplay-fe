"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { firstSection, useSignedOutRedirect } from "./admin-shell";
import { useAdminMe } from "./queries";

/** Sends each person to the first section their role can open, so nobody lands on a locked door. */
export function AdminHome() {
  const router = useRouter();
  const me = useAdminMe();
  const out = useSignedOutRedirect(me.error);
  const target = me.data ? firstSection(me.data.permissions) : undefined;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (out) return null;
  if (me.data && target === null) {
    return (
      <p role="alert" className="bg-card border-border rounded-[14px] border p-5 text-sm">
        Your role doesn&apos;t give access to any section yet. Ask the business owner to update it.
      </p>
    );
  }
  return <Skeleton className="h-24 rounded-[14px]" />;
}
