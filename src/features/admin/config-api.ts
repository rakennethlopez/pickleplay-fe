import { ApiError, call } from "@/features/booking/api";
import {
  blockoutListSchema,
  blockoutSchema,
  bookingDetailSchema,
  bookingListSchema,
  calendarSchema,
  courtListSchema,
  courtOptionsSchema,
  courtSchema,
  emptySchema,
  operationsSchema,
  overviewSchema,
  pricingSchema,
  roleListSchema,
  roleSchema,
  staffListSchema,
  staffSchema,
  type Operations,
  type UpdatePricingRequest,
} from "./config-schema";

export const getOverview = () => call("/api/admin/overview", overviewSchema);

export const getCalendar = (date?: string) =>
  call(date ? `/api/admin/calendar?date=${date}` : "/api/admin/calendar", calendarSchema);

export interface BookingQuery {
  status: string;
  q: string;
  courtId: string;
  from: string;
  to: string;
  offset: number;
}

export const getBookings = (query: BookingQuery) => {
  const params = new URLSearchParams({ status: query.status, limit: "25", offset: String(query.offset) });
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.courtId) params.set("courtId", query.courtId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return call(`/api/admin/bookings?${params}`, bookingListSchema);
};

export const getBooking = (id: string) => call(`/api/admin/bookings/${id}`, bookingDetailSchema);

/** Court names only, for a filter or a picker, for roles that cannot manage courts. */
export const getCourtOptions = (scope: "bookings" | "blockouts") =>
  call(`/api/admin/${scope}/courts`, courtOptionsSchema);

export const getCourts = () => call("/api/admin/courts", courtListSchema);
export const createCourt = (name: string) => call("/api/admin/courts", courtSchema, { method: "POST", body: { name } });
export const updateCourt = (id: string, body: { name?: string; active?: boolean }) =>
  call(`/api/admin/courts/${id}`, courtSchema, { method: "PATCH", body });
export const reorderCourts = (ids: string[]) =>
  call("/api/admin/courts/order", courtListSchema, { method: "PUT", body: { ids } });

export const getBlockouts = (when: "upcoming" | "past") => call(`/api/admin/blockouts?when=${when}`, blockoutListSchema);
export const createBlockout = (body: { courtId: string | null; startsAt: string; endsAt: string; reason: string }) =>
  call("/api/admin/blockouts", blockoutSchema, { method: "POST", body });
export const removeBlockout = (id: string) => call(`/api/admin/blockouts/${id}`, emptySchema, { method: "DELETE", body: undefined });

export const getPricing = () => call("/api/admin/pricing", pricingSchema);
export const updatePricing = (body: UpdatePricingRequest) => call("/api/admin/pricing", pricingSchema, { method: "PATCH", body });
export const getOperations = () => call("/api/admin/settings", operationsSchema);
export const updateOperations = (body: Partial<Operations>) => call("/api/admin/settings", operationsSchema, { method: "PATCH", body });

export const getStaff = () => call("/api/admin/staff", staffListSchema);
export const createStaff = (body: { email: string; displayName: string; roleId: string; password: string }) =>
  call("/api/admin/staff", staffSchema, { method: "POST", body });
export const updateStaff = (id: string, body: { displayName?: string; roleId?: string; status?: "active" | "disabled" }) =>
  call(`/api/admin/staff/${id}`, staffSchema, { method: "PATCH", body });
export const setStaffPassword = (id: string, password: string) =>
  call(`/api/admin/staff/${id}/password`, staffSchema, { method: "POST", body: { password } });
export const unlockStaff = (id: string) => call(`/api/admin/staff/${id}/unlock`, staffSchema, { method: "POST", body: undefined });

export const getRoles = () => call("/api/admin/roles", roleListSchema);
export const createRole = (body: { name: string; description?: string; permissions: string[] }) =>
  call("/api/admin/roles", roleSchema, { method: "POST", body });
export const updateRole = (id: string, body: { name?: string; description?: string; permissions?: string[] }) =>
  call(`/api/admin/roles/${id}`, roleSchema, { method: "PATCH", body });
export const removeRole = (id: string) => call(`/api/admin/roles/${id}`, emptySchema, { method: "DELETE", body: undefined });

export interface Clash {
  id: string;
  ref: string;
  court: string;
  startsAt: string;
  endsAt: string;
  status: string;
  guestName: string | null;
}

/** The bookings that stand in the way of a change, when the API refused it for that reason. */
export function clashesOf(error: unknown): Clash[] {
  if (!(error instanceof ApiError)) return [];
  const list = error.details?.bookings;
  return Array.isArray(list) ? (list as Clash[]) : [];
}

/** One plain sentence for a refusal. The API's own wording is kept when it is a business rule. */
export function refusalText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Your role can't do this. Ask the business owner for access.";
    if (error.status === 429) return "Too many tries. Wait a moment and try again.";
    if ((error.status === 400 || error.status === 409 || error.status === 404 || error.status === 422) && error.message && !error.message.startsWith("Request failed")) {
      return error.message;
    }
    if (error.status === 400) return "Check the values and try again. Nothing was changed.";
  }
  return "We couldn't reach the server. Nothing was changed.";
}
