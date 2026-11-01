import { z } from "zod";
import {
  availabilitySchema,
  bookingSchema,
  checkoutResultSchema,
  holdSchema,
  paymentInstructionsSchema,
  receiptResultSchema,
  replaceResultSchema,
  settingsSchema,
  cancelCodeSchema,
  type CancellationRequestForm,
  type CheckoutRequest,
  type CreateHoldRequest,
  type FindRequest,
} from "./schema";

/** A refusal from the API. `code` is the machine-readable reason (slot_taken, hold_expired, ...). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    message?: string,
    /** The rest of the refusal's body, e.g. the bookings that stand in the way of a change. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message ?? `Request failed (${status})`);
  }
}

/** Calls one of our own BFF routes and checks the answer's shape. Shared with the admin screens. */
export async function call<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body: unknown },
): Promise<T> {
  // FormData sets its own multipart boundary header; JSON bodies are sent as JSON.
  const isForm = init?.body instanceof FormData;
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: init ? (isForm ? (init.body as FormData) : JSON.stringify(init.body)) : undefined,
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body ?? {}) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof error.code === "string" ? error.code : undefined,
      typeof error.message === "string" ? error.message : undefined,
      error,
    );
  }
  return schema.parse(body);
}

export const getSettings = () => call("/api/settings", settingsSchema);

export const getAvailability = (date?: string) =>
  call(
    date ? `/api/availability?date=${date}` : "/api/availability",
    availabilitySchema,
  );

export const createHold = (body: CreateHoldRequest) =>
  call("/api/holds", holdSchema, { method: "POST", body });

export const getHold = (holdId: string) =>
  call(`/api/holds/${holdId}`, holdSchema);

export const checkout = (holdId: string, body: CheckoutRequest) =>
  call(`/api/holds/${holdId}/checkout`, checkoutResultSchema, {
    method: "POST",
    body,
  });

export const getPayment = (holdId: string) =>
  call(`/api/holds/${holdId}/payment`, paymentInstructionsSchema);

const fileBody = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};

/** The first receipt: moves the booking to Pending review and returns the private link token. */
export const submitReceipt = (holdId: string, file: File) =>
  call(`/api/holds/${holdId}/receipt`, receiptResultSchema, {
    method: "POST",
    body: fileBody(file),
  });

export const replaceReceipt = (token: string, file: File) =>
  call(`/api/bookings/${token}/receipt`, replaceResultSchema, {
    method: "POST",
    body: fileBody(file),
  });

/** Cancels a booking the guest may still cancel themselves. Returns the updated booking. */
export const cancelBooking = (token: string, code?: string) =>
  call(`/api/bookings/${token}/cancel`, bookingSchema, {
    method: "POST",
    body: { code: code || undefined },
  });

/** Asks an administrator for an exception after the cutoff. Does not cancel anything. */
export const requestCancellation = (token: string, body: CancellationRequestForm) =>
  call(`/api/bookings/${token}/cancel-request`, bookingSchema, {
    method: "POST",
    body: { reason: body.reason, code: body.code || undefined },
  });

/** Sends the verification code to the booking's mobile number (a no-op while SMS is off). */
export const sendCancelCode = (token: string) =>
  call(`/api/bookings/${token}/cancel-code`, cancelCodeSchema, {
    method: "POST",
    body: undefined,
  });

export const getBooking = (token: string) =>
  call(`/api/bookings/${token}`, bookingSchema);

export const findBooking = (body: FindRequest) =>
  call("/api/bookings/find", bookingSchema, { method: "POST", body });
