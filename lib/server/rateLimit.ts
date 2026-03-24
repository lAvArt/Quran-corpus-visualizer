import { NextRequest, NextResponse } from "next/server";

export interface RateLimitPolicy {
  namespace: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  identifier: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0]?.trim();
    if (firstAddress) return firstAddress;
  }

  const realIp = request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
  if (realIp?.trim()) return realIp.trim();

  return "anonymous";
}

export function consumeRateLimit(
  request: NextRequest,
  policy: RateLimitPolicy
): RateLimitDecision {
  const now = Date.now();
  const identifier = getClientIdentifier(request);
  const key = `${policy.namespace}:${identifier}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const freshEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + policy.windowMs,
    };
    rateLimitStore.set(key, freshEntry);
    return {
      allowed: true,
      limit: policy.maxRequests,
      remaining: Math.max(0, policy.maxRequests - freshEntry.count),
      resetAt: freshEntry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(policy.windowMs / 1000)),
      identifier,
    };
  }

  if (existing.count >= policy.maxRequests) {
    return {
      allowed: false,
      limit: policy.maxRequests,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      identifier,
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return {
    allowed: true,
    limit: policy.maxRequests,
    remaining: Math.max(0, policy.maxRequests - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    identifier,
  };
}

export function applyRateLimitHeaders(
  response: NextResponse,
  decision: RateLimitDecision
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(decision.limit));
  response.headers.set("X-RateLimit-Remaining", String(decision.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(decision.resetAt / 1000)));
  return response;
}

export function rateLimitExceededResponse(
  message: string,
  decision: RateLimitDecision
): NextResponse {
  const response = NextResponse.json(
    {
      error: message,
      retryAfter: decision.retryAfterSeconds,
    },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(decision.retryAfterSeconds));
  return applyRateLimitHeaders(response, decision);
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
