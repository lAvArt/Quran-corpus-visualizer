import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase email confirmation / password-reset callback.
 * Exchanges the one-time `code` query param for a session cookie.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // `next=update-password` must land on the auth-scoped page
            // (/auth/update-password → middleware adds the locale); a bare
            // /update-password localizes to a nonexistent route.
            const redirectPath =
                next === "update-password"
                    ? "/auth/update-password"
                    : next.startsWith("/") ? next : `/${next}`;
            return NextResponse.redirect(`${origin}${redirectPath}`);
        }
    }

    // Something went wrong — send back to login with error hint
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
