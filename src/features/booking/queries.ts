import { useQuery } from "@tanstack/react-query";
import { getAvailability, getSettings } from "./api";

/** Business settings (hold minutes, slot rules, day parts). They rarely change. */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 5 * 60_000,
  });
}

/**
 * The slot grid for one date, or for today when no date is given (the response says what "today"
 * is in Manila). It refreshes while open so Held and Booked stay current; the server remains the
 * only authority on what can be booked.
 */
export function useAvailability(date?: string) {
  return useQuery({
    queryKey: ["availability", date ?? "today"],
    queryFn: () => getAvailability(date),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
