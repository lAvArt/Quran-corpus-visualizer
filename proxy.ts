import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createMiddlewareClient } from "./lib/supabase/middleware-client";
import { isSupabaseFetchError } from "./lib/supabase/errors";

const handleI18n = createIntlMiddleware(routing);

// Arab League member states — a visitor from any of these gets Arabic as the
// FIRST-VISIT default; everyone else gets English. Only consulted when the
// URL carries no locale prefix AND no NEXT_LOCALE cookie exists (i.e. a true
// first contact) — an explicit language switch sets the cookie and wins on
// every later visit.
const ARABIC_COUNTRIES = new Set([
  "DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR",
  "MA", "OM", "PS", "QA", "SA", "SD", "SO", "SY", "TN", "AE", "YE",
]);

/** Country → default locale; null when the geo header is absent (local dev,
 *  non-Vercel hosts) so next-intl's own detection takes over. */
function detectGeoLocale(request: NextRequest): "ar" | "en" | null {
  const country = request.headers.get("x-vercel-ip-country");
  if (!country) return null;
  return ARABIC_COUNTRIES.has(country.toUpperCase()) ? "ar" : "en";
}

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

  // Geo-based first-visit locale: no prefix + no stored preference → route by
  // visitor country and persist the choice, so next-intl's Accept-Language /
  // defaultLocale fallbacks never see this request.
  const { pathname } = request.nextUrl;
  const hasLocalePrefix = /^\/(en|ar|pseudo)(\/|$)/.test(pathname);
  const hasLocaleCookie = request.cookies.has("NEXT_LOCALE");
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const geoLocale = detectGeoLocale(request);
    if (geoLocale) {
      const url = request.nextUrl.clone();
      url.pathname = `/${geoLocale}${pathname === "/" ? "" : pathname}`;
      const geoRedirect = NextResponse.redirect(url);
      // Carry the Supabase session cookies the client above may have set.
      response.cookies.getAll().forEach((cookie) => {
        geoRedirect.cookies.set(cookie);
      });
      geoRedirect.cookies.set("NEXT_LOCALE", geoLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return geoRedirect;
    }
  }

  const intlResponse = handleI18n(request);

  response.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    // Keep locale handling off API routes, framework internals, embed routes,
    // and static public assets. NOTE: data files like the QAC morphology .txt
    // MUST be excluded here — otherwise the locale prefix (/en/data/…) 404s the
    // fetch and the corpus loses all roots/POS (no coloured bars / arcs).
    // auth/callback is the locale-LESS Supabase OAuth/email callback (a route
    // handler, not a page): localizing it 307'd /auth/callback?code=… to a
    // nonexistent /{locale}/auth/callback and dropped the one-time code —
    // Google sign-in could never complete.
    // sw.js: service workers hard-reject scripts served via redirect, so the
    // locale 307 (/sw.js → /{locale}/sw.js) broke PWA registration outright.
    "/((?!api|trpc|embed|data|auth/callback|sw\\.js|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|json|csv|woff2?)$).*)",
  ],
};
