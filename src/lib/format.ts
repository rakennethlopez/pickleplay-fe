// Every time in Pickleplay is Philippine time (Asia/Manila, UTC+8, no daylight saving).
const TZ = "Asia/Manila";

const clean = (value: string) => value.replace(/\s/g, " ");

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const hourOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  hour12: true,
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "6 PM", or "6:30 PM" when it is not on the hour. */
export function timeLabel(iso: string) {
  const d = new Date(iso);
  return clean(d.getUTCMinutes() === 0 ? hourOnly.format(d) : time.format(d));
}

/** "6:00 – 8:00 PM" (the meridiem is only repeated when it changes). */
export function rangeLabel(startIso: string, endIso: string) {
  const start = clean(time.format(new Date(startIso)));
  const end = clean(time.format(new Date(endIso)));
  const suffix = (v: string) => v.slice(-2);
  return suffix(start) === suffix(end)
    ? `${start.slice(0, -3)} – ${end}`
    : `${start} – ${end}`;
}

/** "Fri 30 Oct" for an instant or a Manila calendar date (YYYY-MM-DD). */
export function dayLabel(value: string) {
  const d = value.length === 10 ? new Date(`${value}T00:00:00+08:00`) : new Date(value);
  return clean(dayFormat.format(d)).replace(",", "");
}

/** The two lines of a day-strip button: ["Fri", "30"]. */
export function dayChip(date: string): [string, string] {
  const [weekday, day] = clean(dayParts.format(new Date(`${date}T00:00:00+08:00`)))
    .replace(",", "")
    .split(" ");
  return [weekday, day];
}

/** Minutes after Manila midnight for an instant. */
export function manilaMinutes(iso: string) {
  const [h, m] = clock.format(new Date(iso)).split(":").map(Number);
  return h * 60 + m;
}

/** "6 AM – 12 PM" / "12 – 5 PM" for a day-part given as "HH:MM" bounds ("24:00" = end of day). */
export function hourRangeLabel(start: string, end: string) {
  const hour = (v: string) => Number(v.split(":")[0]);
  const h12 = (h: number) => h % 12 || 12;
  const meridiem = (h: number) => (h % 24 < 12 ? "AM" : "PM");
  const s = hour(start);
  const e = hour(end);
  return meridiem(s) === meridiem(e)
    ? `${h12(s)} – ${h12(e)} ${meridiem(e)}`
    : `${h12(s)} ${meridiem(s)} – ${h12(e)} ${meridiem(e)}`;
}

/** The Manila calendar date (YYYY-MM-DD) of an instant. */
export function manilaDate(iso: string) {
  return new Date(new Date(iso).getTime() + 8 * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

export function addDays(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** "₱1,200.00", or null while the business has not set a rate. */
export function pesos(amount: string | null) {
  if (amount === null) return null;
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "11 h 20 min", "45 min", for a span given in minutes. */
export function spanLabel(totalMinutes: number) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  return h === 0 ? `${m} min` : `${h} h ${m % 60} min`;
}

export function countdown(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
