import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // السماح فقط للـ /login و /api بدون تحقق
  const publicPaths = ["/login", "/api"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const loggedIn = req.cookies.get("userLoggedIn")?.value;

  if (!loggedIn || loggedIn !== "true") {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};