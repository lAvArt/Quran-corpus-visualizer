import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/corpus/cooccurrence?xkind=root|lemma&x=…&y=…&limit=10
 *
 * Ayahs where X and Y stand together — the home page's correlation search.
 *
 * Exists because the home page deliberately has no corpus in memory, and the
 * offline indexes cannot answer a pair: lemma-form-stats caps refs at 10 per
 * entry, so intersecting ref lists breaks for any word with more than ten
 * occurrences (إنسان alone has 71). The corpus_tokens table has both words'
 * normalized columns, so the pair question is two indexed lookups and a join.
 *
 * X arrives pre-resolved (the home result already knows its bare root or
 * corpus-spelled lemma). Y is a user-typed companion; it matches by lemma OR
 * root, so قنوط (a lemma) and يأس (a root) both work. The window is the ayah —
 * token distance would need positions, which drift from QAC numbering in the
 * ~435 merged-word ayahs (the reason the home carousel highlights by content).
 */

function dbNormalize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[ً-ٰٟـ]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .trim();
}

interface TokenRow {
    sura: number;
    ayah: number;
    position: number;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const xkind = searchParams.get("xkind") === "lemma" ? "lemma" : "root";
    const x = dbNormalize(searchParams.get("x")?.trim() ?? "");
    const y = dbNormalize(searchParams.get("y")?.trim() ?? "");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "10"), 1), 20);

    if (!x || !y) {
        return NextResponse.json({ error: "x and y params are required" }, { status: 400 });
    }

    try {
        const supabase = await createClient();
        const xColumn = xkind === "lemma" ? "lemma_normalized" : "root_normalized";

        // Two bounded scans; the intersection happens here rather than in SQL
        // because the anon-readable tables expose no RPC for it, and both sides
        // are small (the most frequent root, قول, is ~1,700 rows of 3 ints).
        const [{ data: xRows, error: xErr }, { data: yRows, error: yErr }] = await Promise.all([
            supabase.from("corpus_tokens").select("sura,ayah,position").eq(xColumn, x).limit(5000),
            supabase
                .from("corpus_tokens")
                .select("sura,ayah,position")
                .or(`lemma_normalized.eq.${y},root_normalized.eq.${y}`)
                .limit(5000),
        ]);
        if (xErr) throw xErr;
        if (yErr) throw yErr;

        const yAyahs = new Set((yRows ?? []).map((r: TokenRow) => `${r.sura}:${r.ayah}`));
        const seen = new Set<string>();
        // One entry per co-occurrence ayah, carrying X's first position in it
        // (the carousel deep-links that word; highlighting is content-based).
        const shared: { sura: number; ayah: number; word: number }[] = [];
        for (const r of (xRows ?? []) as TokenRow[]) {
            const key = `${r.sura}:${r.ayah}`;
            if (!yAyahs.has(key) || seen.has(key)) continue;
            seen.add(key);
            shared.push({ sura: r.sura, ayah: r.ayah, word: r.position });
        }
        shared.sort((a, b) => a.sura - b.sura || a.ayah - b.ayah);

        const ids = shared.slice(0, limit).map((r) => `${r.sura}:${r.ayah}`);
        let ayahs: { sura: number; ayah: number; word: number; text: string }[] = [];
        if (ids.length) {
            const { data: texts, error: tErr } = await supabase
                .from("ayahs")
                .select("id,text_uthmani")
                .in("id", ids);
            if (tErr) throw tErr;
            const textById = new Map((texts ?? []).map((r) => [r.id as string, r.text_uthmani as string]));
            ayahs = shared.slice(0, limit).map((r) => ({
                ...r,
                text: textById.get(`${r.sura}:${r.ayah}`) ?? "",
            }));
        }

        return NextResponse.json({ count: shared.length, ayahs });
    } catch (err) {
        console.error("[/api/corpus/cooccurrence]", err);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
