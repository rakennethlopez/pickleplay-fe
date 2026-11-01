import type { Metadata } from "next";
import { LoginForm } from "@/features/admin/login-form";

export const metadata: Metadata = {
  title: "Staff sign-in · Pickleplay",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="bg-paper flex min-h-dvh flex-col items-center justify-center gap-6 px-5 py-10">
      <p className="font-display text-court-green text-3xl uppercase">pickleplay</p>
      <LoginForm />
    </main>
  );
}
