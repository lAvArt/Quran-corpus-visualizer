import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createMiddlewareClient } from "./lib/supabase/middleware-client";

const handleI18n = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
    // 1. Refresh the Supabase session so RSCs on this request can call getUser()
    const response = NextResponse.next({ request });
    const { supabase } = createMiddlewareClient(request, response);

    // Refresh session (updates cookies in the response if the token was rotated)
    await supabase.auth.getUser();

    // 2. Run next-intl routing (locale detection + redirect)
    const intlResponse = handleI18n(request);

    // Propagate any Set-Cookie headers from the Supabase refresh into the
    // intl response so that both cookie mutations reach the browser.
    response.cookies.getAll().forEach((cookie) => {
        intlResponse.cookies.set(cookie);
    });

    return intlResponse;
}

export const config = {
    // Match only internationalized pathnames
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
