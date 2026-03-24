import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    applyRateLimitHeaders,
    consumeRateLimit,
    rateLimitExceededResponse,
} from "@/lib/server/rateLimit";

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

function parseEnvNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitPolicy() {
    return {
        namespace: "semantic-search",
        maxRequests: parseEnvNumber("SEMANTIC_SEARCH_RATE_LIMIT_MAX", 12),
        windowMs: parseEnvNumber("SEMANTIC_SEARCH_RATE_LIMIT_WINDOW_MS", 60_000),
    };
}

/**
 * POST /api/search/semantic
 * Body: { query: string; limit?: number; similarity_threshold?: number }
 *
 * Generates an embedding via OpenAI, then calls search_roots_semantic().
 * Results below the similarity threshold are filtered out.
 * All results are marked as AI-assisted to support transparency UI.
 */
export async function POST(request: NextRequest) {
    const rateLimit = consumeRateLimit(request, getRateLimitPolicy());
    if (!rateLimit.allowed) {
        return rateLimitExceededResponse("Semantic search rate limit exceeded", rateLimit);
    }

    const respond = (body: unknown, init?: ResponseInit) =>
        applyRateLimitHeaders(NextResponse.json(body, init), rateLimit);

    const body = await request.json().catch(() => null);
    if (!body || typeof body.query !== "string" || !body.query.trim()) {
        return respond({ error: "body.query is required" }, { status: 400 });
    }

    const matchCount = Math.min(Number(body.limit ?? 10), 50);
    const threshold = Math.max(
        0,
        Math.min(1, Number(body.similarity_threshold ?? DEFAULT_SIMILARITY_THRESHOLD))
    );
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return respond({ error: "Semantic search not configured" }, { status: 503 });
    }

    try {
        // Generate embedding with OpenAI text-embedding-3-small (768-dim output)
        const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: body.query.trim(),
                dimensions: 768,
            }),
        });

        if (!embeddingRes.ok) {
            const text = await embeddingRes.text();
            console.error("[/api/search/semantic] OpenAI error:", text);
            return respond({ error: "Embedding generation failed" }, { status: 502 });
        }

        const embData = await embeddingRes.json() as {
            data: Array<{ embedding: number[] }>;
        };
        const embedding = embData.data[0]?.embedding;
        if (!embedding) {
            return respond({ error: "Empty embedding response" }, { status: 502 });
        }

        // Query Supabase — request more than needed so we can filter by threshold
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("search_roots_semantic", {
            query_embedding: embedding,
            match_count: matchCount,
        });
        if (error) throw error;

        // Filter by similarity threshold and add transparency metadata
        const filtered = (data ?? [])
            .filter((row: { root: string; similarity: number }) => row.similarity >= threshold)
            .map((row: { root: string; similarity: number }) => ({
                root: row.root,
                similarity: Math.round(row.similarity * 100) / 100,
                isAiAssisted: true,
            }));

        return respond({
            results: filtered,
            metadata: {
                model: "text-embedding-3-small",
                threshold,
                disclaimer: "Results use AI-assisted vector similarity and may not reflect established tafsir interpretations.",
            },
        });
    } catch (err) {
        console.error("[/api/search/semantic]", err);
        return respond({ error: "Semantic search failed" }, { status: 500 });
    }
}
