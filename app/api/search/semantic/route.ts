import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/search/semantic
 * Body: { query: string; limit?: number }
 *
 * Generates an embedding via OpenAI, then calls search_roots_semantic().
 */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.query !== "string" || !body.query.trim()) {
        return NextResponse.json({ error: "body.query is required" }, { status: 400 });
    }

    const matchCount = Math.min(Number(body.limit ?? 10), 50);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Semantic search not configured" }, { status: 503 });
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
            return NextResponse.json({ error: "Embedding generation failed" }, { status: 502 });
        }

        const embData = await embeddingRes.json() as {
            data: Array<{ embedding: number[] }>;
        };
        const embedding = embData.data[0]?.embedding;
        if (!embedding) {
            return NextResponse.json({ error: "Empty embedding response" }, { status: 502 });
        }

        // Query Supabase
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("search_roots_semantic", {
            query_embedding: embedding,
            match_count: matchCount,
        });
        if (error) throw error;

        return NextResponse.json({ results: data ?? [] });
    } catch (err) {
        console.error("[/api/search/semantic]", err);
        return NextResponse.json({ error: "Semantic search failed" }, { status: 500 });
    }
}
