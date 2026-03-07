/**
 * scripts/generate-embeddings.ts
 *
 * Generates root embeddings via OpenAI text-embedding-3-small (768-dim)
 * and upserts them into the `root_embeddings` table.
 *
 * Usage:
 *   npx dotenv -e .env.local -- tsx scripts/generate-embeddings.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
    console.error("Missing required environment variables");
    process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

async function embedTexts(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
            model: "text-embedding-3-small",
            input: texts,
            dimensions: 768,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error: ${text}`);
    }
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
}

async function main() {
    console.log("🔍 Fetching distinct roots from corpus_tokens…");

    const { data: roots, error } = await supabase
        .from("corpus_tokens")
        .select("root")
        .not("root", "is", null)
        .order("root");

    if (error) { console.error(error); process.exit(1); }

    const uniqueRoots = [...new Set((roots ?? []).map((r) => r.root as string))];
    console.log(`  Found ${uniqueRoots.length} unique roots`);

    const CHUNK = 100; // OpenAI allows up to 2048 inputs
    for (let i = 0; i < uniqueRoots.length; i += CHUNK) {
        const batch = uniqueRoots.slice(i, i + CHUNK);
        const embeddings = await embedTexts(batch);

        const rows = batch.map((root, j) => ({
            root,
            embedding: embeddings[j],
            model: "text-embedding-3-small",
        }));

        const { error: upsertErr } = await supabase
            .from("root_embeddings")
            .upsert(rows, { onConflict: "root" });

        if (upsertErr) { console.error("Upsert error:", upsertErr); process.exit(1); }
        console.log(`  ✓ ${i + batch.length} / ${uniqueRoots.length} roots embedded`);
    }

    console.log("✅ Embedding generation complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
