import { describe, expect, it } from "vitest";
import { toggleSlot } from "./selection";

const slot = (hour: number) =>
  new Date(Date.UTC(2026, 9, 30, hour - 8)).toISOString(); // Manila hour
const [h17, h18, h19, h20, h21] = [17, 18, 19, 20, 21].map(slot);

describe("toggleSlot", () => {
  it("starts a selection", () => {
    expect(toggleSlot([], h18, 4, 60)).toEqual([h18]);
  });

  it("extends the run forwards and backwards", () => {
    expect(toggleSlot([h18], h19, 4, 60)).toEqual([h18, h19]);
    expect(toggleSlot([h18], h17, 4, 60)).toEqual([h17, h18]);
  });

  it("starts over when the slot is not adjacent", () => {
    expect(toggleSlot([h18], h20, 4, 60)).toEqual([h20]);
  });

  it("stops at the maximum number of hours in a row", () => {
    expect(toggleSlot([h17, h18], h19, 2, 60)).toEqual([h19]);
    expect(toggleSlot([h17, h18, h19], h20, 4, 60)).toEqual([h17, h18, h19, h20]);
  });

  it("shrinks from an end and restarts from the middle", () => {
    expect(toggleSlot([h18, h19, h20], h18, 4, 60)).toEqual([h19, h20]);
    expect(toggleSlot([h18, h19, h20], h20, 4, 60)).toEqual([h18, h19]);
    expect(toggleSlot([h18, h19, h20], h19, 4, 60)).toEqual([h19]);
    expect(toggleSlot([h18], h18, 4, 60)).toEqual([]);
  });

  it("respects other slot lengths", () => {
    const half = new Date(new Date(h18).getTime() + 30 * 60_000).toISOString();
    expect(toggleSlot([h18], half, 4, 30)).toEqual([h18, half]);
    expect(toggleSlot([h18], h21, 4, 30)).toEqual([h21]);
  });
});
