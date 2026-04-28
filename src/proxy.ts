import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const userStatus = (session?.user as { status?: string } | undefined)?.status;

  // Public routes — allow through
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/pending") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/seed"  // dev-only seed endpoint
  ) {
    return NextResponse.next();
  }

  // Not logged in → redirect to login
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Pending user → redirect to pending page
  if (userStatus === "pending" && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/pending", req.url));
  }

  // Suspended → back to login
  if (userStatus === "suspended") {
    return NextResponse.redirect(new URL("/login?error=suspended", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
