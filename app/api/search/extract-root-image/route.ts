import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitExceededResponse,
} from "@/lib/server/rateLimit";
import { normalizeArabicForSearch } from "@/lib/search/indexes";

const NON_ARABIC_MARKS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ARABIC_LETTERS_RE = /[^\u0621-\u063A\u0641-\u064A]/g;
const SUPPORTED_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|webp);base64,/i;

interface VisionCandidate {
  text?: unknown;
  root?: unknown;
  confidence?: unknown;
}

function parseEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitPolicy() {
  return {
    namespace: "extract-root-image",
    maxRequests: parseEnvNumber("IMAGE_ROOT_RATE_LIMIT_MAX", 6),
    windowMs: parseEnvNumber("IMAGE_ROOT_RATE_LIMIT_WINDOW_MS", 60_000),
  };
}

function normalizeArabicToken(value: string): string {
  return normalizeArabicForSearch(value.normalize("NFKC"))
    .replace(NON_ARABIC_MARKS_RE, "")
    .replace(NON_ARABIC_LETTERS_RE, "");
}

function clampConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeVisionCandidates(candidates: VisionCandidate[], maxCandidates: number) {
  const deduped = new Map<string, { text: string; root: string | null; confidence: number }>();

  for (const candidate of candidates) {
    if (typeof candidate.text !== "string") continue;

    const text = normalizeArabicToken(candidate.text);
    if (text.length < 2) continue;

    const rootValue =
      typeof candidate.root === "string" && candidate.root.trim()
        ? normalizeArabicToken(candidate.root)
        : null;
    const root = rootValue && rootValue.length >= 3 && rootValue.length <= 5 ? rootValue : null;
    const confidence = clampConfidence(candidate.confidence);
    const key = `${text}:${root ?? ""}`;
    const existing = deduped.get(key);

    if (!existing || confidence > existing.confidence) {
      deduped.set(key, {
        text,
        root,
        confidence: Math.round(confidence * 100) / 100,
      });
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxCandidates);
}

function buildPrompt(maxCandidates: number): string {
  return [
    "Analyze this cropped camera frame of Arabic Quranic text.",
    `Return at most ${maxCandidates} clearly visible word candidates.`,
    "Reply as a JSON object with a single `candidates` array.",
    "Each candidate must include:",
    "- `text`: the visible Arabic word only",
    "- `root`: the Arabic root without spaces or diacritics when reasonably confident, otherwise null",
    "- `confidence`: a number from 0 to 1",
    "Do not transliterate.",
    "Do not include explanation text.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit(request, getRateLimitPolicy());
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse("Image root extraction rate limit exceeded", rateLimit);
  }

  const respond = (body: unknown, init?: ResponseInit) =>
    applyRateLimitHeaders(NextResponse.json(body, init), rateLimit);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.imageDataUrl !== "string") {
    return respond({ error: "body.imageDataUrl is required" }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl.trim();
  if (!SUPPORTED_IMAGE_RE.test(imageDataUrl)) {
    return respond({ error: "Unsupported image format" }, { status: 400 });
  }

  if (imageDataUrl.length > 6_000_000) {
    return respond({ error: "Image payload too large" }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return respond({ error: "Image root extraction not configured" }, { status: 503 });
  }

  const maxCandidates = Math.min(Math.max(Number(body.maxCandidates ?? 6), 1), 10);
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract Arabic word candidates from Quranic camera frames for a morphology explorer.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(maxCandidates) },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                  detail: "low",
                },
              },
            ],
          },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const text = await openAiResponse.text();
      console.error("[/api/search/extract-root-image] OpenAI error:", text);
      return respond({ error: "Image analysis failed" }, { status: 502 });
    }

    const payload = (await openAiResponse.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return respond({ error: "Empty image analysis response" }, { status: 502 });
    }

    const parsed = JSON.parse(content) as { candidates?: VisionCandidate[] };
    const candidates = normalizeVisionCandidates(parsed.candidates ?? [], maxCandidates);

    return respond({
      candidates,
      metadata: {
        model,
        disclaimer:
          "AI-assisted image extraction may misread Arabic text. Verify the matched token before relying on it.",
      },
    });
  } catch (error) {
    console.error("[/api/search/extract-root-image]", error);
    return respond({ error: "Image root extraction failed" }, { status: 500 });
  }
}
