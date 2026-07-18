/**
 * Motion preferences for imperative (D3-driven) animation.
 *
 * CSS animations are already disabled globally under
 * `@media (prefers-reduced-motion: reduce)` (see globals.css), but D3
 * transitions and framer-motion spring configs set durations in JS and
 * bypass that rule — they must consult these helpers instead.
 */

/** True when the user asks for reduced motion. SSR-safe (false on server). */
export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Duration for a D3 transition: 0 under reduced motion, else the given ms. */
export function motionSafeDuration(ms: number): number {
    return prefersReducedMotion() ? 0 : ms;
}

/**
 * Per-item entrance delay with a hard cap so large collections never feel
 * slow: min(index * perItemMs, capMs), and 0 under reduced motion.
 * Default cap 600ms per the app's motion guidelines.
 */
export function motionSafeStagger(index: number, perItemMs: number, capMs = 600): number {
    if (prefersReducedMotion()) return 0;
    return Math.min(index * perItemMs, capMs);
}
