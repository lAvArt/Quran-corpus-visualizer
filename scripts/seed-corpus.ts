/**
 * scripts/seed-corpus.ts
 *
 * Populates the `corpus_tokens` and `ayahs` tables in Supabase with the full
 * Quranic corpus.  Data is combined from two sources:
 *
 *   1. Quran.com API v4  – Arabic word text, Uthmani/Imlaei scripts.
 *   2. Quranic Arabic Corpus morphology file (public/data/)
 *      – roots (ROOT:), lemmas (LEM:), POS tags, morphological features.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-corpus.ts
 *
 * The script is idempotent: it upserts on primary key so running it multiple
 * times is safe (useful to re-seed after schema changes).
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// ── config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const MORPHOLOGY_FILE = path.resolve(
    process.cwd(),
    "public/data/quranic-corpus-morphology-0.4.txt"
);
const API_BASE = "https://api.quran.com/api/v4";
const UPSERT_CHUNK = 500;    // rows per Supabase upsert call
const DELAY_MS     = 120;    // between API requests to avoid rate-limits

// ── Supabase client (service-role, bypasses RLS) ──────────────────────────────

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

// ── Buckwalter transliteration → Arabic ───────────────────────────────────────

const BW: Record<string, string> = {
    "'": "ء", "|": "آ", ">": "أ", "<": "إ", "&": "ؤ", "}": "ئ",
    A: "ا", b: "ب", p: "ة", t: "ت", v: "ث", j: "ج", H: "ح", x: "خ",
    d: "د", "*": "ذ", r: "ر", z: "ز", s: "س", $: "ش", S: "ص", D: "ض",
    T: "ط", Z: "ظ", E: "ع", g: "غ", f: "ف", q: "ق", k: "ك", l: "ل",
    m: "م", n: "ن", h: "ه", w: "و", Y: "ى", y: "ي",
    F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ", "~": "ّ", o: "ْ",
    "`": "ٰ", "{": "ٱ",
};
const BW_STRIP = new Set(["^", "@", "_", ".", ",", "2", "[", "]"]);

function bwToArabic(input: string): string {
    let out = "";
    let lastHaraka: string | null = null;
    let lastBase: string | null = null;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (BW_STRIP.has(ch)) continue;
        if (ch === "#") {
            let hm = "ء";
            if (lastHaraka === "i" || lastBase === "ي" || lastBase === "ى") hm = "ئ";
            else if (lastHaraka === "u" || lastBase === "و") hm = "ؤ";
            else if (input[i + 1] === "a" || input[i + 1] === "A") hm = "أ";
            out += hm; lastHaraka = null; lastBase = hm; continue;
        }
        const vow = "aui o~FNK`".includes(ch);
        if (vow) { lastHaraka = ch; } else { lastHaraka = null; }
        const ar = BW[ch] ?? ch;
        out += ar;
        if (!vow) lastBase = ar;
    }
    return out;
}

function normalizePos(raw: string): string {
    const p = raw.toUpperCase();
    if (p.startsWith("V")) return "V";
    if (p === "ADJ") return "ADJ";
    if (["PRON", "REL", "DEM"].includes(p)) return "PRON";
    if (["P", "CONJ", "DET", "REM", "INL", "VOC", "NEG", "INTG", "COND", "SUB", "RSLT", "T"].includes(p)) return "P";
    return "N";
}

interface MorphEntry {
    root: string;
    lemma: string;
    pos: string;
    features: Record<string, string>;
    stem: string | null;
}

// ── Parse morphology file ─────────────────────────────────────────────────────

function parseMorphologyFile(filePath: string): Map<string, MorphEntry> {
    console.log(`📖  Parsing ${filePath} ...`);
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    const map = new Map<string, MorphEntry & { hasRoot: boolean }>();

    for (const line of lines) {
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("\t");
        if (parts.length < 4) continue;
        const location = parts[0];
        const tag = parts[2]?.trim() ?? "";
        const featRaw = parts[3]?.trim() ?? "";
        const match = location.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
        if (!match) continue;

        const key = `${match[1]}:${match[2]}:${match[3]}`;
        const feats = featRaw.split("|").filter(Boolean);

        const findFeat = (prefix: string) => {
            const tok = feats.find(f => f.startsWith(`${prefix}:`));
            return tok ? tok.slice(prefix.length + 1) : null;
        };

        const root  = findFeat("ROOT");
        const lemma = findFeat("LEM");
        const posRaw = findFeat("POS") ?? tag;
        const pos = normalizePos(posRaw || "N");

        const buildFeatureMap = () => {
            const fm: Record<string, string> = {};
            for (const f of feats) {
                if (!f || f.startsWith("ROOT:") || f.startsWith("LEM:") || f.startsWith("POS:")) continue;
                if (f.includes(":")) {
                    const [k, v] = f.split(":", 2);
                    if (k && v) fm[k] = v;
                } else { fm[f] = "true"; }
            }
            return fm;
        };

        const entry = map.get(key) ?? { root: "", lemma: "", pos, features: {}, stem: null, hasRoot: false };

        if (root) {
            entry.root = bwToArabic(root);
            entry.lemma = lemma ? bwToArabic(lemma) : entry.lemma;
            entry.pos = pos;
            entry.features = buildFeatureMap();
            entry.stem = entry.lemma || null;
            entry.hasRoot = true;
        } else if (!entry.hasRoot) {
            if (!entry.lemma) entry.lemma = lemma ? bwToArabic(lemma) : (parts[1] ? bwToArabic(parts[1]) : "");
            entry.pos = entry.pos || pos;
            if (!Object.keys(entry.features).length) entry.features = buildFeatureMap();
            entry.stem = entry.lemma || null;
        }
        map.set(key, entry);
    }

    const result = new Map<string, MorphEntry>();
    for (const [k, { hasRoot: _hr, ...e }] of map.entries()) result.set(k, e);
    console.log(`   ✓  ${result.size.toLocaleString()} morphology entries`);
    return result;
}

// ── Quran.com API helpers ─────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
}

interface QChapter { id: number; name_simple: string; verses_count: number; }
interface QVerse  {
    verse_number: number; verse_key: string;
    text_uthmani?: string; text_imlaei_simple?: string; text_simple?: string;
    words?: Array<{ position: number; char_type_name: string; text: string }>;
}

async function fetchChapters(): Promise<QChapter[]> {
    const data = await apiGet<{ chapters: QChapter[] }>("/chapters?language=en");
    return data.chapters;
}

async function fetchAllVerses(chapterId: number): Promise<QVerse[]> {
    const all: QVerse[] = [];
    let page = 1;
    while (true) {
        const data = await apiGet<{ verses: QVerse[]; pagination: { next_page: number | null } }>(
            `/verses/by_chapter/${chapterId}?words=true&per_page=50&page=${page}` +
            `&fields=${["text_uthmani", "text_imlaei_simple", "text_simple"].join(",")}`
        );
        all.push(...data.verses);
        if (!data.pagination.next_page) break;
        page = data.pagination.next_page;
    }
    return all;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("🌿  Corpus seeding started\n");

    const morphMap = parseMorphologyFile(MORPHOLOGY_FILE);

    console.log("\n📡  Fetching chapter list from Quran.com …");
    const chapters = await fetchChapters();
    console.log(`   ✓  ${chapters.length} chapters\n`);

    let totalTokens = 0;
    let totalAyahs  = 0;

    for (const chapter of chapters) {
        process.stdout.write(`   Surah ${String(chapter.id).padStart(3)} ${chapter.name_simple.padEnd(20)} `);

        const verses = await fetchAllVerses(chapter.id);

        const tokenRows: Database["public"]["Tables"]["corpus_tokens"]["Insert"][] = [];
        const ayahRows:  Database["public"]["Tables"]["ayahs"]["Insert"][] = [];

        for (const verse of verses) {
            ayahRows.push({
                id:           `${chapter.id}:${verse.verse_number}`,
                sura_id:      chapter.id,
                ayah_number:  verse.verse_number,
                text_uthmani: verse.text_uthmani ?? "",
                text_simple:  verse.text_imlaei_simple ?? verse.text_simple ?? null,
            });

            if (!verse.words) continue;
            for (const word of verse.words) {
                if (word.char_type_name !== "word") continue;
                const tokenId = `${chapter.id}:${verse.verse_number}:${word.position}`;
                const morph   = morphMap.get(tokenId);
                tokenRows.push({
                    id:       tokenId,
                    sura:     chapter.id,
                    ayah:     verse.verse_number,
                    position: word.position,
                    text:     word.text,
                    root:     morph?.root  ?? "",
                    lemma:    morph?.lemma ?? word.text,
                    pos:      morph?.pos   ?? "N",
                    morphology: morph ? {
                        features: morph.features,
                        stem:  morph.stem,
                        gloss: null,
                    } : null,
                });
            }
        }

        // Upsert ayahs
        for (let i = 0; i < ayahRows.length; i += UPSERT_CHUNK) {
            const { error } = await supabase.from("ayahs").upsert(
                ayahRows.slice(i, i + UPSERT_CHUNK),
                { onConflict: "id" }
            );
            if (error) { console.error("\nAyah upsert error:", error); process.exit(1); }
        }

        // Upsert tokens
        for (let i = 0; i < tokenRows.length; i += UPSERT_CHUNK) {
            const { error } = await supabase.from("corpus_tokens").upsert(
                tokenRows.slice(i, i + UPSERT_CHUNK),
                { onConflict: "id" }
            );
            if (error) { console.error("\nToken upsert error:", error); process.exit(1); }
        }

        const rootedCount = tokenRows.filter(t => t.root && (t.root as string).trim()).length;
        process.stdout.write(`${tokenRows.length} tokens (${rootedCount} with roots)\n`);
        totalTokens += tokenRows.length;
        totalAyahs  += ayahRows.length;

        if (chapter.id < chapters.length) await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`\n✅  Done!  ${totalTokens.toLocaleString()} tokens · ${totalAyahs.toLocaleString()} ayahs`);
}

main().catch(err => { console.error(err); process.exit(1); });
