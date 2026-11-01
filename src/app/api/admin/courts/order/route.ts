import type { NextRequest } from "next/server";
import { adminProxy } from "@/lib/admin-api";

export const PUT = (request: NextRequest) => adminProxy(request, "/admin/courts/order", "PUT");
