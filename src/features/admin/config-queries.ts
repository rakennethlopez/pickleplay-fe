import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/features/booking/api";
import {
  getBlockouts,
  getBooking,
  getBookings,
  getCalendar,
  getCourtOptions,
  getCourts,
  getOperations,
  getOverview,
  getPricing,
  getRoles,
  getStaff,
  type BookingQuery,
} from "./config-api";
import { isSignedOut } from "./queries";

// A signed-out answer is final; anything else may be a hiccup worth one retry.
const retry = (count: number, error: unknown) =>
  !isSignedOut(error) && !(error instanceof ApiError && error.status < 500) && count < 1;

export const useOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: getOverview, refetchInterval: 30_000, retry });

export const useCalendar = (date: string | undefined) =>
  useQuery({
    queryKey: ["admin", "calendar", date ?? "today"],
    queryFn: () => getCalendar(date),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    retry,
  });

export const useBookings = (query: BookingQuery) =>
  useQuery({
    queryKey: ["admin", "bookings", query],
    queryFn: () => getBookings(query),
    placeholderData: keepPreviousData,
    retry,
  });

export const useBooking = (id: string | null) =>
  useQuery({ queryKey: ["admin", "booking", id], queryFn: () => getBooking(id!), enabled: id !== null, retry });

export const useCourts = (enabled = true) =>
  useQuery({ queryKey: ["admin", "courts"], queryFn: getCourts, enabled, retry });

export const useCourtOptions = (scope: "bookings" | "blockouts") =>
  useQuery({ queryKey: ["admin", "court-options", scope], queryFn: () => getCourtOptions(scope), retry });

export const useBlockouts = (when: "upcoming" | "past") =>
  useQuery({ queryKey: ["admin", "blockouts", when], queryFn: () => getBlockouts(when), retry });

export const usePricing = (enabled = true) =>
  useQuery({ queryKey: ["admin", "pricing"], queryFn: getPricing, enabled, retry });
export const useOperations = (enabled = true) =>
  useQuery({ queryKey: ["admin", "operations"], queryFn: getOperations, enabled, retry });
export const useStaff = () => useQuery({ queryKey: ["admin", "staff"], queryFn: getStaff, retry });
export const useRoles = () => useQuery({ queryKey: ["admin", "roles"], queryFn: getRoles, retry });
