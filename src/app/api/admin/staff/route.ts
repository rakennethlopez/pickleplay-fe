import type { NextRequest } from "next/server";
import { adminProxy } from "@/lib/admin-api";

export const GET = (request: NextRequest) => adminProxy(request, "/admin/staff");
export const POST = (request: NextRequest) => adminProxy(request, "/admin/staff", "POST");
