import { call } from "@/features/booking/api";
import {
  cancellationDetailSchema,
  cancellationListSchema,
  loginResultSchema,
  logoutResultSchema,
  paymentDetailSchema,
  paymentListSchema,
  phoneRevealSchema,
  profileSchema,
  refundDetailSchema,
  refundListSchema,
  type ApproveExceptionRequest,
  type CancellationFilter,
  type LoginRequest,
  type PaymentFilter,
  type RefundFilter,
  type RejectExceptionRequest,
  type RejectRequest,
  type UpdateRefundRequest,
} from "./schema";

export const getMe = () => call("/api/admin/me", profileSchema);

export const login = (body: LoginRequest) =>
  call("/api/admin/login", loginResultSchema, { method: "POST", body });

export const logout = () =>
  call("/api/admin/logout", logoutResultSchema, {
    method: "POST",
    body: undefined,
  });

export const getPayments = (status: PaymentFilter, q: string) => {
  const query = new URLSearchParams({ status });
  if (q.trim()) query.set("q", q.trim());
  return call(`/api/admin/payments?${query}`, paymentListSchema);
};

export const getPayment = (id: string) =>
  call(`/api/admin/payments/${id}`, paymentDetailSchema);

export const approvePayment = (id: string) =>
  call(`/api/admin/payments/${id}/approve`, paymentDetailSchema, {
    method: "POST",
    body: { confirmMoneyReceived: true },
  });

export const rejectPayment = (id: string, body: RejectRequest) =>
  call(`/api/admin/payments/${id}/reject`, paymentDetailSchema, {
    method: "POST",
    body,
  });

export const revealPhone = (id: string) =>
  call(`/api/admin/payments/${id}/phone`, phoneRevealSchema, {
    method: "POST",
    body: undefined,
  });

export const getCancellations = (status: CancellationFilter, q: string) => {
  const query = new URLSearchParams({ status });
  if (q.trim()) query.set("q", q.trim());
  return call(`/api/admin/cancellations?${query}`, cancellationListSchema);
};

export const getCancellation = (id: string) =>
  call(`/api/admin/cancellations/${id}`, cancellationDetailSchema);

export const approveException = (id: string, body: ApproveExceptionRequest) =>
  call(`/api/admin/cancellations/${id}/approve`, cancellationDetailSchema, {
    method: "POST",
    body,
  });

export const rejectException = (id: string, body: RejectExceptionRequest) =>
  call(`/api/admin/cancellations/${id}/reject`, cancellationDetailSchema, {
    method: "POST",
    body,
  });

export const getRefunds = (status: RefundFilter, q: string) => {
  const query = new URLSearchParams({ status });
  if (q.trim()) query.set("q", q.trim());
  return call(`/api/admin/refunds?${query}`, refundListSchema);
};

export const getRefund = (id: string) =>
  call(`/api/admin/refunds/${id}`, refundDetailSchema);

export const updateRefund = (id: string, body: UpdateRefundRequest) =>
  call(`/api/admin/refunds/${id}/status`, refundDetailSchema, {
    method: "POST",
    body,
  });

/** The BFF URL of one receipt. Opening it is logged on the server each time. */
export const receiptUrl = (paymentId: string, receiptId: string) =>
  `/api/admin/payments/${paymentId}/receipts/${receiptId}`;
