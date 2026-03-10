import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (pathname.startsWith("/admin")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      const roles = (token.roles as string[]) ?? [];

      if (pathname.startsWith("/admin/settings") && !roles.includes("ADMIN")) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      if (pathname.startsWith("/admin/audit") && !roles.includes("ADMIN")) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      if (pathname.startsWith("/admin/team") && !roles.includes("ADMIN")) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        if (
          pathname.startsWith("/v/") ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/api/public/") ||
          pathname.startsWith("/api/auth/") ||
          pathname.startsWith("/api/health")
        ) {
          return true;
        }

        if (pathname.startsWith("/admin")) {
          return !!token;
        }

        if (pathname.startsWith("/api/")) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
