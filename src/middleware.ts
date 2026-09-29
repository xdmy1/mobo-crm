import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin/auth")) return NextResponse.next();
  const hasSession = req.cookies.has("mobo_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/auth/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
