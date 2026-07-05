import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ROOT_GLOSSES } from "@/lib/data/rootGlosses";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitExceededResponse,
} from "@/lib/server/rateLimit";

/**
 * POST /api/search/concept
 * Body: { query: string }
 *
 * Concept (paraphrase) search lane. Claude expands a natural-language query
 * ("verses about patience and gratitude") into concrete corpus terms — Quranic
 * Arabic roots, lemmas, and English gloss keywords — which the client then runs
 * through its BM25F index. Anthropic has no embeddings API, so this is
 * LLM-assisted retrieval, not vector similarity; BM25F grounds every term
 * against real corpus documents, so a hallucinated root simply matches nothing.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";
const DISCLAIMER =
  "Results use AI-assisted query expansion and may not reflect established tafsir interpretations.";

function parseEnvNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitPolicy() {
  return {
    namespace: "concept-search",
    maxRequests: parseEnvNumber("CONCEPT_SEARCH_RATE_LIMIT_MAX", 20),
    windowMs: parseEnvNumber("CONCEPT_SEARCH_RATE_LIMIT_WINDOW_MS", 60_000),
  };
}

// Curated, high-frequency roots + meanings keep Claude anchored to the real
// corpus vocabulary. ROOT_GLOSSES is roughly frequency-ordered.
const GROUNDING = [...ROOT_GLOSSES.entries()]
  .map(([root, gloss]) => `${root} = ${gloss}`)
  .join("\n");

const EXPANSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["roots", "lemmas", "glossKeywords"],
  properties: {
    roots: {
      type: "array",
      items: { type: "string" },
      description: "Quranic Arabic triliteral roots (consonant skeletons) relevant to the query.",
    },
    lemmas: {
      type: "array",
      items: { type: "string" },
      description: "Arabic lemmas (dictionary forms) relevant to the query.",
    },
    glossKeywords: {
      type: "array",
      items: { type: "string" },
      description: "English keywords / synonyms describing the concept.",
    },
  },
} as const;

const SYSTEM_PROMPT = `You map a user's natural-language question about the Qur'an to concrete search terms for a Quranic Arabic corpus.

Return Quranic Arabic triliteral roots (bare consonant skeletons), Arabic lemmas, and English gloss keywords that are relevant to the concept in the query. Prefer roots that appear in the provided reference list of known roots and meanings; you may add other well-attested Quranic roots when clearly relevant. Keep each list focused (at most ~8 items) and ordered by relevance. Do not invent roots that are not real Arabic triliteral roots. Output only the structured JSON.

Reference roots (root = meaning):
${GROUNDING}`;

interface Expansion {
  roots: string[];
  lemmas: string[];
  glossKeywords: string[];
}

function dedupeTerms(values: string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit(request, getRateLimitPolicy());
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse("Concept search rate limit exceeded", rateLimit);
  }

  const respond = (body: unknown, init?: ResponseInit) =>
    applyRateLimitHeaders(NextResponse.json(body, init), rateLimit);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.query !== "string" || !body.query.trim()) {
    return respond({ error: "body.query is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return respond({ error: "Concept search not configured" }, { status: 503 });
  }

  const model = process.env.CONCEPT_SEARCH_MODEL || DEFAULT_MODEL;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: EXPANSION_SCHEMA } },
      messages: [{ role: "user", content: body.query.trim().slice(0, 400) }],
    });

    if (message.stop_reason === "refusal") {
      return respond({ terms: [], roots: [], glossKeywords: [], metadata: { model, disclaimer: DISCLAIMER } });
    }

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    let expansion: Expansion = { roots: [], lemmas: [], glossKeywords: [] };
    if (textBlock) {
      try {
        const parsed = JSON.parse(textBlock.text) as Partial<Expansion>;
        expansion = {
          roots: dedupeTerms(parsed.roots ?? [], 8),
          lemmas: dedupeTerms(parsed.lemmas ?? [], 8),
          glossKeywords: dedupeTerms(parsed.glossKeywords ?? [], 8),
        };
      } catch {
        // Malformed JSON — fall through with empty expansion.
      }
    }

    const terms = dedupeTerms(
      [...expansion.roots, ...expansion.lemmas, ...expansion.glossKeywords],
      24,
    );

    return respond({
      terms,
      roots: expansion.roots,
      glossKeywords: expansion.glossKeywords,
      metadata: { model, disclaimer: DISCLAIMER },
    });
  } catch (err) {
    console.error("[/api/search/concept]", err);
    return respond({ error: "Concept search failed" }, { status: 500 });
  }
}
