import { type NextRequest, NextResponse } from "next/server";
import { AUTH_DISABLED } from "@/lib/feature-flags";
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
    /\.(?:ico|png|jpg|jpeg|gif|svg|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Flag global: si el login está desactivado, mandamos /login a / y dejamos
  // pasar todo lo demás sin chequeo de sesión.
  if (AUTH_DISABLED) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!isSupabaseEnvReady()) {
    return NextResponse.next();
  }

  const { response, user } = await getSupabaseMiddlewareResult(request);
  const isLogin = pathname === "/login";

  if (!user && !isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
