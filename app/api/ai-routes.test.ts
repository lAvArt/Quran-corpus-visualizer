import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockMessagesCreate } = vi.hoisted(() => ({ mockMessagesCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

import { POST as conceptPOST } from "@/app/api/search/concept/route";
import { POST as extractRootImagePOST } from "@/app/api/search/extract-root-image/route";
import { resetRateLimitStore } from "@/lib/server/rateLimit";

function makeJsonRequest(path: string, body: unknown, headers?: HeadersInit): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "198.51.100.20",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("AI API routes", () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.CONCEPT_SEARCH_RATE_LIMIT_MAX;
    delete process.env.CONCEPT_SEARCH_RATE_LIMIT_WINDOW_MS;
    delete process.env.IMAGE_ROOT_RATE_LIMIT_MAX;
    delete process.env.IMAGE_ROOT_RATE_LIMIT_WINDOW_MS;
    vi.stubGlobal("fetch", fetchMock);
  });

  it("expands a concept query into corpus terms and rate-limits", async () => {
    process.env.CONCEPT_SEARCH_RATE_LIMIT_MAX = "1";
    mockMessagesCreate.mockResolvedValue({
      model: "claude-haiku-4-5",
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({ roots: ["صبر", "شكر"], lemmas: [], glossKeywords: ["patience", "gratitude"] }),
        },
      ],
    });

    const first = await conceptPOST(makeJsonRequest("/api/search/concept", { query: "verses about patience" }));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("0");
    const firstBody = await first.json();
    expect(firstBody.terms).toContain("صبر");
    expect(firstBody.terms).toContain("patience");

    const second = await conceptPOST(makeJsonRequest("/api/search/concept", { query: "verses about patience" }));
    expect(second.status).toBe(429);
    const body = await second.json();
    expect(body.error).toMatch(/rate limit/i);
    expect(body.retryAfter).toBeTypeOf("number");
  });

  it("returns 503 when Anthropic is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await conceptPOST(makeJsonRequest("/api/search/concept", { query: "patience" }));
    expect(response.status).toBe(503);
  });

  it("returns normalized AI image extraction candidates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [
                  { text: "ٱلْكِتَٰب", root: "كتب", confidence: 0.91 },
                  { text: "الْكِتَٰب", root: "كتب", confidence: 0.64 },
                  { text: "foo", root: null, confidence: 0.5 },
                ],
              }),
            },
          },
        ],
      }),
    });

    const response = await extractRootImagePOST(
      makeJsonRequest("/api/search/extract-root-image", {
        imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.candidates).toEqual([
      { text: "الكتب", root: "كتب", confidence: 0.91 },
    ]);
    expect(body.metadata.model).toBe("gpt-4o-mini");
  });

  it("rate-limits AI image extraction requests", async () => {
    process.env.IMAGE_ROOT_RATE_LIMIT_MAX = "1";
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidates: [{ text: "نور", root: "نور", confidence: 0.82 }],
              }),
            },
          },
        ],
      }),
    });

    const first = await extractRootImagePOST(
      makeJsonRequest("/api/search/extract-root-image", {
        imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      })
    );
    expect(first.status).toBe(200);

    const second = await extractRootImagePOST(
      makeJsonRequest("/api/search/extract-root-image", {
        imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      })
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });
});
