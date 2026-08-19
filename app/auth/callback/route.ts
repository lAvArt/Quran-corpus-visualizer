import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { landingPath } from "@/lib/auth/landingPath";

/**
 * Supabase OAuth / email-confirmation / password-reset callback.
 * Exchanges the one-time `code` query param for a session cookie.
 *
 * Locale-less on purpose — see the middleware matcher in proxy.ts. The redirect
 * targets below are locale-less too; the middleware localizes them on the way
 * out.
 *
 * Failure modes are reported, never swallowed: this route used to send every
 * failure to `/auth/login?error=auth_callback_failed` while the login page read
 * no query params at all, so a broken handshake looked exactly like a fresh
 * visit to the sign-in form. Each branch now names its own cause.
 */

/** Send the user back to sign-in with a machine-readable reason. */
function backToLogin(origin: string, reason: string, detail?: string | null): NextResponse {
    const url = new URL("/auth/login", origin);
    url.searchParams.set("error", reason);
    // The provider's own words (e.g. "access_denied") — shown only as a hint;
    // the page renders its own translated copy for the reason itself.
    if (detail) url.searchParams.set("error_detail", detail.slice(0, 200));
    return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);

    // 1. The provider (or GoTrue) refused outright — "access_denied" when the
    //    user cancels the Google consent screen, "server_error", etc. There is
    //    no code to exchange in that case; say so rather than reporting a
    //    generic failure.
    const providerError = searchParams.get("error") ?? searchParams.get("error_code");
    if (providerError) {
        return backToLogin(
            origin,
            providerError === "access_denied" ? "auth_cancelled" : "auth_provider_error",
            searchParams.get("error_description") ?? providerError,
        );
    }

    const code = searchParams.get("code");
    if (!code) return backToLogin(origin, "auth_no_code");

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        // Most often: the PKCE verifier cookie is missing because the handshake
        // STARTED on a different host than it finished on. Everything funnels
        // through one canonical origin (next.config.ts redirects +
        // authCallbackUrl) precisely so this cannot happen.
        console.error("[auth/callback] code exchange failed", error.message);
        return backToLogin(origin, "auth_callback_failed", error.message);
    }

    return NextResponse.redirect(new URL(landingPath(searchParams.get("next")), origin));
}
