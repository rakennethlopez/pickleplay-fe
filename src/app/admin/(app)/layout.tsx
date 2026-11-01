import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/admin-shell";

// Everything under /admin except sign-in: its own layout, never linked from the public site.
export const metadata: Metadata = {
  title: "Admin · Pickleplay",
  robots: { index: false, follow: false },
};

export default function AdminAppLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
