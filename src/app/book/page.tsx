import { PublicShell } from "@/components/public-shell";
import { CourtPicker } from "@/features/booking/court-list";

export default function ChooseCourtPage() {
  return (
    <PublicShell back="/" step={1} tabs="book">
      <h1 className="font-display text-ink mb-1 text-4xl uppercase">Choose a court</h1>
      <p className="text-slate mb-5 text-sm">Showing availability for today</p>
      <CourtPicker />
    </PublicShell>
  );
}
