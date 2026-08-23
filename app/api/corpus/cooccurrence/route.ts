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
    // Alternate spelling of Y. The DB normalizes toward full-alif spellings
    // (ابراهيم), while the QAC-derived client indexes carry the rasm
    // (ابرهيم/إِبْرَٰهِيم) — whichever the caller resolved, the other one may be
    // the one the DB knows, so both are matched.
    const yalt = dbNormalize(searchParams.get("yalt")?.trim() ?? "");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "10"), 1), 20);
    // ayah      — both words share the ayah (exact).
    // w5        — same ayah AND within ±5 word positions. Within one ayah the
    //             relative distance survives the QAC↔Quran.com numbering drift
    //             unless a merged word sits between the two — off by 1–2 at
    //             worst, which a ±5 window absorbs.
    // adjacent  — Y stands in the same ayah or the one before/after it. This is
    //             the إذ قال لأبيه pattern (speaker named in the previous ayah),
    //             and it needs no token arithmetic at all, so it is immune to
    //             the drift entirely.
    const windowParam = searchParams.get("window");
    const window = windowParam === "w5" || windowParam === "adjacent" ? windowParam : "ayah";
    // Reach of the adjacent window, in ayahs each side (±1 by default, up to
    // ±10). Cost is one Set lookup per (X row × step) — no extra DB work — so
    // the cap is interpretive, not computational: wider windows inflate counts,
    // and past ~10 ayahs "nearby" stops meaning anything.
    const span = Math.min(Math.max(Number(searchParams.get("span") ?? "1") || 1, 1), 10);

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
                .or(
                    yalt && yalt !== y
                        ? `lemma_normalized.eq.${y},root_normalized.eq.${y},lemma_normalized.eq.${yalt},root_normalized.eq.${yalt}`
                        : `lemma_normalized.eq.${y},root_normalized.eq.${y}`,
                )
                .limit(5000),
        ]);
        if (xErr) throw xErr;
        if (yErr) throw yErr;

        const yAyahs = new Set((yRows ?? []).map((r: TokenRow) => `${r.sura}:${r.ayah}`));
        const yPositions = new Map<string, number[]>();
        for (const r of (yRows ?? []) as TokenRow[]) {
            const key = `${r.sura}:${r.ayah}`;
            const list = yPositions.get(key);
            if (list) list.push(r.position);
            else yPositions.set(key, [r.position]);
        }
        const matches = (r: TokenRow): boolean => {
            const key = `${r.sura}:${r.ayah}`;
            if (window === "w5") {
                const ps = yPositions.get(key);
                return !!ps && ps.some((py) => Math.abs(py - r.position) <= 5);
            }
            if (window === "adjacent") {
                if (yAyahs.has(key)) return true;
                for (let k = 1; k <= span; k++) {
                    if (r.ayah - k >= 1 && yAyahs.has(`${r.sura}:${r.ayah - k}`)) return true;
                    if (yAyahs.has(`${r.sura}:${r.ayah + k}`)) return true;
                }
                return false;
            }
            return yAyahs.has(key);
        };
        const seen = new Set<string>();
        // One entry per co-occurrence ayah, carrying X's first position in it
        // (the carousel deep-links that word; highlighting is content-based).
        const shared: { sura: number; ayah: number; word: number }[] = [];
        // X's token count inside the shared ayahs — the pair card reuses the
        // regular result card, whose headline number means OCCURRENCES, so the
        // subset must be counted in the same unit or the card would silently
        // change what its own biggest number means.
        let xOccurrences = 0;
        for (const r of (xRows ?? []) as TokenRow[]) {
            const key = `${r.sura}:${r.ayah}`;
            if (!matches(r)) continue;
            xOccurrences += 1;
            if (seen.has(key)) continue;
            seen.add(key);
            shared.push({ sura: r.sura, ayah: r.ayah, word: r.position });
        }
        shared.sort((a, b) => a.sura - b.sura || a.ayah - b.ayah);

        // The rest of the card's furniture, in the exact shapes RootStat uses:
        // per-sūrah histogram, top-sūrah chips [suraId, count, firstAyah], and
        // the first shared occurrence.
        const hist = new Array<number>(114).fill(0);
        const firstAyahInSura = new Map<number, number>();
        for (const r of shared) {
            hist[r.sura - 1] += 1;
            if (!firstAyahInSura.has(r.sura)) firstAyahInSura.set(r.sura, r.ayah);
        }
        const top = [...firstAyahInSura.keys()]
            .map((su) => [su, hist[su - 1], firstAyahInSura.get(su)!] as [number, number, number])
            .sort((a, b) => b[1] - a[1] || a[0] - b[0])
            .slice(0, 5);
        const surahs = firstAyahInSura.size;
        const first = shared.length ? { sura: shared[0].sura, ayah: shared[0].ayah } : null;

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

        return NextResponse.json({ count: shared.length, xOccurrences, surahs, first, top, hist, ayahs });
    } catch (err) {
        console.error("[/api/corpus/cooccurrence]", err);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
