/**
 * Where to drop a freshly-signed-in user, given the callback's `next` param.
 *
 * Same-origin paths ONLY. `next` arrives from a URL anyone can craft, and the
 * callback resolves it with `new URL(path, origin)` — under which "//evil.com"
 * resolves to a different ORIGIN entirely. That would be an open redirect on
 * the one route that hands out a session, so the escape shapes are rejected
 * here rather than trusted downstream.
 */
export function landingPath(next: string | null | undefined): string {
    // `next=update-password` must land on the auth-scoped page
    // (/auth/update-password → middleware adds the locale); a bare
    // /update-password localizes to a nonexistent route.
    if (next === "update-password") return "/auth/update-password";
    if (!next) return "/";

    // A scheme ("https:", "javascript:") never belongs in a same-origin path.
    if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return "/";

    const path = next.startsWith("/") ? next : `/${next}`;
    // "//host" — and "/\host", which browsers normalize to it — leave the origin.
    if (/^\/[/\\]/.test(path)) return "/";
    return path;
}
