"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarOff,
  CalendarX,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Tag,
  Trophy,
  Undo2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logout } from "./api";
import { isSignedOut, useAdminMe, useCancellations, usePayments, useRefunds } from "./queries";
import type { Permission } from "./schema";

// Each section shows only for a role that can read it. The server still checks every request, so
// this is about not showing doors that would be locked, never about security.
type BadgeKind = "payments" | "cancellations" | "refunds";
interface NavItem {
  href: string;
  label: string;
  Icon: typeof CreditCard;
  /** Shown when the role holds any one of these. */
  permissions: Permission[];
  badge?: BadgeKind;
}

export const NAV: NavItem[] = [
  { href: "/admin/overview", label: "Overview", Icon: LayoutDashboard, permissions: ["bookings:read"] },
  { href: "/admin/calendar", label: "Calendar", Icon: CalendarDays, permissions: ["bookings:read"] },
  { href: "/admin/bookings", label: "Bookings", Icon: ListChecks, permissions: ["bookings:read"] },
  { href: "/admin/payments", label: "Payment review", Icon: CreditCard, permissions: ["payments:read"], badge: "payments" },
  { href: "/admin/cancellations", label: "Cancellations", Icon: CalendarX, permissions: ["cancellations:read"], badge: "cancellations" },
  { href: "/admin/refunds", label: "Refunds", Icon: Undo2, permissions: ["refunds:read"], badge: "refunds" },
  { href: "/admin/courts", label: "Courts", Icon: Trophy, permissions: ["courts:manage"] },
  { href: "/admin/blockouts", label: "Blocked hours", Icon: CalendarOff, permissions: ["blockouts:manage"] },
  { href: "/admin/pricing", label: "Pricing & hours", Icon: Tag, permissions: ["pricing:manage", "settings:manage"] },
  { href: "/admin/staff", label: "Staff & roles", Icon: Users, permissions: ["staff:manage"] },
];

/** The first section a role can open, for the admin home. */
export const firstSection = (granted: string[]) => NAV.find((n) => n.permissions.some((p) => granted.includes(p)))?.href ?? null;

/** The count of things waiting for someone, shown next to a section's name. */
function NavBadge({ kind }: { kind: BadgeKind }) {
  const payments = usePayments("pending", "", kind === "payments");
  const cancellations = useCancellations("pending", "", kind === "cancellations");
  const refunds = useRefunds("open", "", kind === "refunds");
  const count =
    kind === "payments"
      ? payments.data?.summary.pending
      : kind === "cancellations"
        ? cancellations.data?.summary.pending
        : refunds.data
          ? refunds.data.summary.pending + refunds.data.summary.processing + refunds.data.summary.needsAttention
          : undefined;
  if (!count) return null;
  return (
    <span
      className="bg-ball-lime text-court-green ml-auto rounded-full px-2 text-xs font-semibold"
      aria-label={`${count} waiting`}
    >
      {count}
    </span>
  );
}

/** Redirects to sign-in when the server says there is no session. Shared by every admin screen. */
export function useSignedOutRedirect(...errors: unknown[]) {
  const router = useRouter();
  const out = errors.some(isSignedOut);
  useEffect(() => {
    if (out) router.replace("/admin/login");
  }, [out, router]);
  return out;
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useAdminMe().data;
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.filter((item) => item.permissions.some((p) => me?.permissions.includes(p))).map(({ href, label, Icon, badge }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
              active ? "bg-turf text-primary-foreground" : "text-primary-foreground/80 hover:bg-turf/60",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {badge ? <NavBadge kind={badge} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Account() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useAdminMe();
  const signOut = useMutation({
    mutationFn: logout,
    // Signed out locally even if the call failed (the cookies are cleared either way).
    onSettled: () => {
      queryClient.clear();
      router.replace("/admin/login");
    },
  });
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="text-primary-foreground/80">
        <p className="text-primary-foreground font-semibold">{me.data?.displayName ?? "…"}</p>
        <p>Role: {me.data?.role ?? "…"}</p>
      </div>
      <Button
        variant="outline"
        className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-turf hover:text-primary-foreground"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const me = useAdminMe();
  const out = useSignedOutRedirect(me.error);
  const [open, setOpen] = useState(false);

  if (out) return null;

  return (
    <div className="bg-paper flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop: fixed sidebar. */}
      <aside className="bg-court-green text-primary-foreground hidden w-60 shrink-0 flex-col gap-6 p-4 lg:flex">
        <p className="font-display px-3 pt-2 text-2xl uppercase">
          pickleplay <span className="text-ball-lime text-sm">admin</span>
        </p>
        <Suspense fallback={<div className="h-11" />}>
          <Nav />
        </Suspense>
        <div className="mt-auto">
          <Account />
        </div>
      </aside>

      {/* Mobile: top bar with a drawer. */}
      <header className="bg-court-green text-primary-foreground flex h-14 items-center gap-3 px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Open menu"
                className="hover:bg-turf text-primary-foreground"
              />
            }
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="bg-court-green text-primary-foreground w-72 gap-6 p-4">
            <SheetTitle className="font-display text-primary-foreground text-2xl uppercase">
              pickleplay <span className="text-ball-lime text-sm">admin</span>
            </SheetTitle>
            <Suspense fallback={<div className="h-11" />}>
              <Nav onNavigate={() => setOpen(false)} />
            </Suspense>
            <div className="mt-auto">
              <Account />
            </div>
          </SheetContent>
        </Sheet>
        <p className="font-display text-xl uppercase">pickleplay admin</p>
      </header>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
