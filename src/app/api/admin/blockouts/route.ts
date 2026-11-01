import type { NextRequest } from "next/server";
import { adminProxy } from "@/lib/admin-api";

export const GET = (request: NextRequest) => adminProxy(request, "/admin/blockouts");
export const POST = (request: NextRequest) => adminProxy(request, "/admin/blockouts", "POST");
