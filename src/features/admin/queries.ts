import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/features/booking/api";
import {
  getCancellation,
  getCancellations,
  getMe,
  getPayment,
  getPayments,
  getRefund,
  getRefunds,
} from "./api";
import type {
  CancellationFilter,
  PaymentFilter,
  Permission,
  RefundFilter,
} from "./schema";

/** True when the server says there is no signed-in administrator (session ended or expired). */
export const isSignedOut = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

// A signed-out answer is final; anything else may be a hiccup worth one retry.
const retry = (count: number, error: unknown) =>
  !isSignedOut(error) && !(error instanceof ApiError && error.status < 500) && count < 1;

/** Who is signed in and what their role allows. The server still checks every action. */
export function useAdminMe() {
  return useQuery({
    queryKey: ["admin", "me"],
    queryFn: getMe,
    staleTime: 60_000,
    // Notices a session ended elsewhere (signed out, account disabled) within a minute.
    refetchInterval: 60_000,
    retry,
  });
}

export function useCan(permission: Permission) {
  const { data } = useAdminMe();
  // Unknown until the profile loads, so a button is never shown and then taken away.
  return data ? data.permissions.includes(permission) : null;
}

/** The review queue. It refreshes on its own so overdue and due-soon stay current. */
export function usePayments(status: PaymentFilter, q: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "payments", status, q],
    queryFn: () => getPayments(status, q),
    enabled,
    refetchInterval: 30_000,
    retry,
  });
}

export function useCancellations(status: CancellationFilter, q: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "cancellations", status, q],
    queryFn: () => getCancellations(status, q),
    enabled,
    refetchInterval: 30_000,
    retry,
  });
}

export function useCancellation(id: string | null) {
  return useQuery({
    queryKey: ["admin", "cancellation", id],
    queryFn: () => getCancellation(id!),
    enabled: id !== null,
    refetchInterval: 30_000,
    retry,
  });
}

export function useRefunds(status: RefundFilter, q: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "refunds", status, q],
    queryFn: () => getRefunds(status, q),
    enabled,
    refetchInterval: 30_000,
    retry,
  });
}

export function useRefund(id: string | null) {
  return useQuery({
    queryKey: ["admin", "refund", id],
    queryFn: () => getRefund(id!),
    enabled: id !== null,
    refetchInterval: 30_000,
    retry,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ["admin", "payment", id],
    queryFn: () => getPayment(id),
    refetchInterval: 30_000,
    retry,
  });
}
