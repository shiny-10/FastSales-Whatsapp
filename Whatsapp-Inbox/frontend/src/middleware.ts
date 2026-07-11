import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Authentication removed for the frontend — allow all requests through.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
