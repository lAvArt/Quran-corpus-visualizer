import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search?q=&mode=fts|trigram|exact&limit=20
 * Routes corpus search to the appropriate Supabase DB function.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const mode = searchParams.get("mode") ?? "fts";
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    if (!q) {
        return NextResponse.json({ error: "q param is required" }, { status: 400 });
    }

    const supabase = await createClient();

    try {
        if (mode === "trigram") {
            const threshold = Number(searchParams.get("threshold") ?? "0.2");
            const { data, error } = await supabase.rpc("search_corpus_trigram", {
                query: q,
                limit_n: limit,
                threshold,
            });
            if (error) throw error;
            return NextResponse.json({ results: data ?? [] });
        }

        // Default: full-text search
        const { data, error } = await supabase.rpc("search_corpus_fts", {
            query: q,
            limit_n: limit,
        });
        if (error) throw error;
        return NextResponse.json({ results: data ?? [] });
    } catch (err) {
        console.error("[/api/search]", err);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
