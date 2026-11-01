import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { FindForm } from "@/features/status/find-form";

export const metadata: Metadata = {
  title: "Find my booking · Pickleplay",
  robots: { index: false, follow: false },
};

export default function FindPage() {
  return (
    <PublicShell tabs="booking">
      <FindForm />
    </PublicShell>
  );
}
