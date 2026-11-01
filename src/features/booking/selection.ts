/**
 * Slot selection rules for the grid. A selection is a sorted run of adjacent slot starts (ISO
 * strings) belonging to one court and day, at most `max` long.
 */
export function toggleSlot(
  selection: string[],
  clicked: string,
  max: number,
  slotMinutes: number,
): string[] {
  const slotMs = slotMinutes * 60_000;
  const at = (iso: string) => new Date(iso).getTime();

  const index = selection.indexOf(clicked);
  if (index !== -1) {
    // Tapping an end of the run shrinks it; tapping the middle restarts from that slot.
    if (index === 0) return selection.slice(1);
    if (index === selection.length - 1) return selection.slice(0, -1);
    return [clicked];
  }

  if (selection.length === 0) return [clicked];
  const first = at(selection[0]);
  const last = at(selection[selection.length - 1]);
  const time = at(clicked);

  if (selection.length < max) {
    if (time === last + slotMs) return [...selection, clicked];
    if (time === first - slotMs) return [clicked, ...selection];
  }
  // Not adjacent (or already at the limit): start a new selection from this slot.
  return [clicked];
}
