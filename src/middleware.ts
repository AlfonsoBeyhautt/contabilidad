import { type NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/feature-flags";
import { APP_HOME, isPublicPath } from "@/lib/public-routes";
import { getSupabaseMiddlewareResult } from "@/lib/supabase/supabase-middleware";

function isSupabaseEnvReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    /\.(?:ico|png|jpg|jpeg|gif|svg|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (AUTH_DISABLED) {
    if (pathname === "/login" || pathname === "/registro") {
      return NextResponse.redirect(new URL(APP_HOME, request.url));
    }
    return NextResponse.next();
  }

  if (!isSupabaseEnvReady()) {
    return NextResponse.next();
  }

  const { response, user } = await getSupabaseMiddlewareResult(request);
  const isLogin = pathname === "/login";
  const isRegistro = pathname === "/registro";
  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isLogin || isRegistro)) {
    return NextResponse.redirect(new URL(APP_HOME, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
