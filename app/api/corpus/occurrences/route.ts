import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/corpus/occurrences?kind=root|lemma&term=<arabic>&limit=10
 *
 * Returns the FIRST `limit` distinct ayahs (sūrah order) that contain the given
 * root or lemma, each with its Uthmani text and the surface form(s) that
 * matched (so the client can highlight the searched word). Powers the home
 * search result's verse carousel — the total occurrence count comes from the
 * precomputed stats, so this only needs the preview set.
 *
 * corpus_tokens / ayahs are anon-readable (RLS public SELECT), so no RPC.
 */

// Mirror the DB generated-column normalization (002_corpus.sql): lower, strip
// harakat + dagger-alif + tatweel, fold alif variants. NOTE: unlike the search
// key it does NOT fold ى→ي / ة→ه, matching root_normalized / lemma_normalized.
function dbNormalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .trim();
}

const norm = (s: string) => dbNormalize(s);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "lemma" ? "lemma" : "root";
  const term = searchParams.get("term")?.trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "10"), 1), 20);

  if (!term) {
    return NextResponse.json({ error: "term param is required" }, { status: 400 });
  }

  const column = kind === "lemma" ? "lemma_normalized" : "root_normalized";
  const wanted = norm(term);
  if (!wanted) return NextResponse.json({ ayahs: [] });

  try {
    const supabase = await createClient();

    // 1. Matching tokens in sūrah order. Bounded fetch — plenty to yield the
    //    first `limit` distinct ayahs even for high-frequency terms.
    const { data: toks, error: tErr } = await supabase
      .from("corpus_tokens")
      .select("sura,ayah,text")
      .eq(column, wanted)
      .order("sura", { ascending: true })
      .order("ayah", { ascending: true })
      .order("position", { ascending: true })
      .limit(400);
    if (tErr) throw tErr;

    // 2. First `limit` distinct ayahs, collecting matched surfaces per ayah.
    const order: string[] = [];
    const matches = new Map<string, Set<string>>();
    for (const t of toks ?? []) {
      const key = `${t.sura}:${t.ayah}`;
      let set = matches.get(key);
      if (!set) {
        if (order.length >= limit) continue;
        set = new Set<string>();
        matches.set(key, set);
        order.push(key);
      }
      if (t.text) set.add(t.text);
    }
    if (order.length === 0) return NextResponse.json({ ayahs: [] });

    // 3. Ayah texts.
    const { data: rows, error: aErr } = await supabase
      .from("ayahs")
      .select("id,text_uthmani")
      .in("id", order);
    if (aErr) throw aErr;
    const textById = new Map((rows ?? []).map((r) => [r.id as string, r.text_uthmani as string]));

    const ayahs = order.map((key) => {
      const [sura, ayah] = key.split(":").map(Number);
      return {
        sura,
        ayah,
        text: textById.get(key) ?? "",
        matches: [...(matches.get(key) ?? [])],
      };
    });

    return NextResponse.json({ ayahs });
  } catch (err) {
    console.error("[/api/corpus/occurrences]", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
