import { ArrowLeft, CalendarDays, House, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "home" | "book" | "booking";

interface PublicShellProps {
  children: React.ReactNode;
  /** Shows a back arrow to this href. */
  back?: string;
  /** Three-step progress shown on every booking screen. */
  step?: 1 | 2 | 3;
  /** Bottom tabs appear on home and status screens only, to keep one forward path while booking. */
  tabs?: Tab;
}

const STEPS = ["Court", "Time", "Pay"];

export function PublicShell({ children, back, step, tabs }: PublicShellProps) {
  return (
    <div className="bg-paper mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col">
      <header className="bg-court-green text-primary-foreground flex h-14 items-center gap-3 px-5">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="-ml-3 flex size-12 items-center justify-center"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        ) : null}
        <Link href="/" className="font-display text-xl uppercase tracking-wide">
          pickleplay
        </Link>
        <Link
          href="/find"
          className="ml-auto flex min-h-12 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          My booking
        </Link>
      </header>

      {step ? <Stepper step={step} /> : null}

      <main className={cn("flex flex-1 flex-col px-5 py-6", tabs && "pb-28")}>
        {children}
      </main>

      {tabs ? <BottomTabs active={tabs} /> : null}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="Booking progress"
      className="bg-mist text-ink flex items-center justify-center gap-4 px-5 py-3 text-sm"
    >
      {STEPS.map((label, i) => {
        const n = i + 1;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              current ? "font-semibold" : "text-slate",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                n < step || current
                  ? "bg-court-green text-primary-foreground"
                  : "border-slate text-slate border",
              )}
            >
              {n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

const TAB_LINKS = [
  { id: "home", href: "/", label: "Home", Icon: House },
  { id: "book", href: "/book", label: "Book", Icon: CalendarDays },
  { id: "booking", href: "/find", label: "My booking", Icon: Search },
] as const;

function BottomTabs({ active }: { active: Tab }) {
  return (
    <nav
      aria-label="Main"
      className="border-border bg-card fixed inset-x-0 bottom-0 z-10 mx-auto flex h-[84px] max-w-md border-t pb-[env(safe-area-inset-bottom)]"
    >
      {TAB_LINKS.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={id === active ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
            id === active ? "text-court-green font-semibold" : "text-slate",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
