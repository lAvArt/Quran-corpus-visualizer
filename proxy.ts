import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createMiddlewareClient } from "./lib/supabase/middleware-client";
import { isSupabaseFetchError } from "./lib/supabase/errors";

const handleI18n = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { supabase } = createMiddlewareClient(request, response);

  try {
    await supabase.auth.getUser();
  } catch (error) {
    if (!isSupabaseFetchError(error)) {
      throw error;
    }
    console.warn("[proxy] Supabase unavailable, continuing without session refresh");
  }

  const intlResponse = handleI18n(request);

  response.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
