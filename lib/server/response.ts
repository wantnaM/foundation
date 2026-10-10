import "server-only";
import { NextResponse } from "next/server";
import type { ApiSuccess } from "@/types/api";

export function apiSuccess<T>(data: T) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data });
}
