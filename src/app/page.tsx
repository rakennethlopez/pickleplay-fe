import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { OpenToday } from "@/features/booking/court-list";
import { cn } from "@/lib/utils";

const STEPS = [
  "Choose a court and the day you want to play.",
  "Pick your hours. We hold them while you pay.",
  "Pay with GCash or Maya and get your private booking link.",
];

export default function Home() {
  return (
    <PublicShell tabs="home">
      <section className="flex flex-col gap-5">
        <p className="text-slate text-sm">5 courts · Open 24/7 · No account needed</p>
        <h1 className="font-display text-court-green text-5xl uppercase leading-none">
          Your court is waiting.
        </h1>
        <p className="text-ink">Pick a court, choose a time, pay with GCash or Maya.</p>
        <Link
          href="/book"
          className={cn(
            buttonVariants({ size: "touch" }),
            "bg-court-green text-ball-lime hover:bg-turf w-full font-display text-xl uppercase",
          )}
        >
          Book a Court
        </Link>
      </section>

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="open-today">
        <div className="flex items-baseline justify-between">
          <h2 id="open-today" className="text-ink text-base font-semibold">
            Open today
          </h2>
          <Link href="/book" className="text-court-green text-sm font-semibold underline">
            See all
          </Link>
        </div>
        <OpenToday />
      </section>

      <section className="mt-8 flex flex-col gap-3" aria-labelledby="how">
        <h2 id="how" className="text-ink text-base font-semibold">
          How it works
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step} className="text-ink flex items-start gap-3 text-sm">
              <span className="bg-court-green text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </PublicShell>
  );
}
