import { describe, expect, it } from "vitest";
import {
  addDays,
  countdown,
  dayChip,
  dayLabel,
  hourRangeLabel,
  manilaDate,
  manilaMinutes,
  pesos,
  rangeLabel,
  timeLabel,
} from "./format";

// 2026-10-30 10:00 UTC is 18:00 in Manila.
const SIX_PM = "2026-10-30T10:00:00.000Z";
const EIGHT_PM = "2026-10-30T12:00:00.000Z";

describe("time formatting is always Philippine time", () => {
  it("labels hours", () => {
    expect(timeLabel(SIX_PM)).toBe("6 PM");
    expect(timeLabel("2026-10-30T10:30:00.000Z")).toBe("6:30 PM");
    expect(timeLabel("2026-10-29T16:00:00.000Z")).toBe("12 AM");
  });

  it("labels ranges, repeating the meridiem only when it changes", () => {
    expect(rangeLabel(SIX_PM, EIGHT_PM)).toBe("6:00 – 8:00 PM");
    expect(rangeLabel("2026-10-30T02:00:00.000Z", EIGHT_PM)).toBe("10:00 AM – 8:00 PM");
  });

  it("labels days from a date or an instant", () => {
    expect(dayLabel("2026-10-30")).toBe("Fri 30 Oct");
    expect(dayLabel(SIX_PM)).toBe("Fri 30 Oct");
    expect(dayChip("2026-10-30")).toEqual(["Fri", "30"]);
  });

  it("finds the Manila date and minutes of an instant", () => {
    expect(manilaDate("2026-10-30T17:00:00.000Z")).toBe("2026-10-31");
    expect(manilaMinutes(SIX_PM)).toBe(18 * 60);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("hourRangeLabel", () => {
  it.each([
    ["00:00", "06:00", "12 – 6 AM"],
    ["06:00", "12:00", "6 AM – 12 PM"],
    ["12:00", "17:00", "12 – 5 PM"],
    ["17:00", "24:00", "5 PM – 12 AM"],
  ])("%s to %s", (start, end, expected) => {
    expect(hourRangeLabel(start, end)).toBe(expected);
  });
});

describe("pesos and countdown", () => {
  it("formats money and treats a missing rate as null", () => {
    expect(pesos("1200")).toBe("₱1,200.00");
    expect(pesos(null)).toBeNull();
  });

  it("formats a countdown and never goes negative", () => {
    expect(countdown(14 * 60 + 12)).toBe("14:12");
    expect(countdown(5)).toBe("0:05");
    expect(countdown(-3)).toBe("0:00");
  });
});
