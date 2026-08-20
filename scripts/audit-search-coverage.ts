/**
 * Audit: can the home search resolve every word in the Qurʾān to the root the
 * corpus actually assigns it?
 *
 * The morphology file is ground truth — it states the root for every token — so
 * for each distinct surface word we ask the real resolver (form index, root
 * index, name index, in the same order MinimalHome tries them) and compare.
 *
 * Three failure classes come out of it:
 *   MISS        nothing resolves the word at all
 *   WRONG-ROOT  it resolves, but to a different root than the corpus assigns —
 *               the dangerous one, because the UI answers confidently
 *   COLLISION   several distinct roots normalize to one search key; the index
 *               stores one root per key, so the others are unreachable by that
 *               spelling (أَبًّا "fodder" vs أَبًا "a father" → both `ابا`)
 *
 * Run: npx tsx scripts/audit-search-coverage.ts [--limit N] [--json out.json]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArabicForSearch, foldRasmAlef, searchKeyVariants } from "../lib/search/arabicNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const MORPH = path.join(ROOT_DIR, "public", "data", "quranic-corpus-morphology-0.4.txt");
const FORMS = path.join(ROOT_DIR, "public", "data", "form-index.json");
const ROOTS = path.join(ROOT_DIR, "public", "data", "root-stats.json");
const NAMES = path.join(ROOT_DIR, "public", "data", "name-stats.json");

const BW2AR: Record<string, string> = {
  "'": "ء", "|": "آ", ">": "أ", "<": "إ", "&": "ؤ", "}": "ئ", A: "ا", b: "ب",
  p: "ة", t: "ت", v: "ث", j: "ج", H: "ح", x: "خ", d: "د", "*": "ذ", r: "ر",
  z: "ز", s: "س", $: "ش", S: "ص", D: "ض", T: "ط", Z: "ظ", E: "ع", g: "غ",
  f: "ف", q: "ق", k: "ك", l: "ل", m: "م", n: "ن", h: "ه", w: "و", Y: "ى",
  y: "ي", F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ", "~": "ّ", o: "ْ",
  "`": "ٰ", "{": "ٱ",
};
// Quranic orthography marks that carry no letter (maddah, small-alef markers,
// pause marks...). MUST match build-form-index.ts — the audit reconstructs the
// same surface strings the index was keyed from, and an out-of-sync STRIP makes
// every marked word look like a search miss. (It did, on the first run: 3037
// phantom misses, ~21% of the corpus, all of them this bug.)
const STRIP = new Set(["^", "@", "_", ".", ",", "2", "[", "]", "#"]);
const bw2ar = (input: string): string => {
  let out = "";
  for (const ch of input) if (!STRIP.has(ch)) out += BW2AR[ch] ?? ch;
  return out;
};
const feat = (fs_: string[], name: string) =>
  fs_.find((f) => f.startsWith(`${name}:`))?.slice(name.length + 1) ?? null;

const PROCLITIC = /^(وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/;

interface Word { surf: string; root: string | null; ref: string }

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args[args.indexOf("--limit") + 1]) || 25;
  const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;

  const forms: Record<string, string> = JSON.parse(await fs.readFile(FORMS, "utf8")).forms;
  const roots: Record<string, unknown> = JSON.parse(await fs.readFile(ROOTS, "utf8")).roots;
  const nameIdx = JSON.parse(await fs.readFile(NAMES, "utf8"));
  const nameKeys = new Set<string>([
    ...Object.keys(nameIdx.names ?? {}),
    ...Object.keys(nameIdx.aliasIndex ?? {}),
  ]);

  // ── Ground truth: rebuild words exactly as build-form-index.ts does ──
  const words = new Map<string, Word>();
  for (const line of (await fs.readFile(MORPH, "utf8")).split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const m = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}:${m[3]}`;
    const root = feat((parts[3] ?? "").split("|").filter(Boolean), "ROOT");
    let w = words.get(key);
    if (!w) { w = { surf: "", root: null, ref: `${m[1]}:${m[2]}` }; words.set(key, w); }
    w.surf += parts[1] ?? "";
    if (root && !w.root) w.root = bw2ar(root);
  }

  // ── The resolver, mirroring lib/corpus/formIndexClient.lookupFormRoot ──
  const resolveKey = (k: string) => {
    if (forms[k]) return forms[k];
    const stripped = k.replace(PROCLITIC, "");
    if (stripped.length >= 2 && forms[stripped]) return forms[stripped];
    return null;
  };
  const resolve = (q: string): string | null => {
    const variants = searchKeyVariants(q);
    for (const v of variants) { const h = resolveKey(v); if (h) return h; }
    for (const v of variants) {
      const f = foldRasmAlef(v);
      if (f !== v) { const h = resolveKey(f); if (h) return h; }
    }
    const n = normalizeArabicForSearch(q);
    if (roots[n]) return n;               // typed a bare root
    return null;
  };

  // ── Walk every distinct surface word ──
  const seen = new Set<string>();
  const miss: { word: string; root: string; ref: string }[] = [];
  const wrong: { word: string; expected: string; got: string; ref: string }[] = [];
  const claims = new Map<string, Map<string, { ref: string; word: string }>>();
  let checked = 0, ok = 0, nameOnly = 0;

  for (const w of words.values()) {
    if (!w.root) continue;                            // particles / proper nouns
    const surface = bw2ar(w.surf);
    const norm = normalizeArabicForSearch(surface);
    if (!norm) continue;
    // Track every root that wants this key — the collision set.
    if (!claims.has(norm)) claims.set(norm, new Map());
    claims.get(norm)!.set(w.root, { ref: w.ref, word: surface });
    if (seen.has(norm)) continue;
    seen.add(norm);
    checked += 1;
    const got = resolve(surface);
    if (got === w.root) ok += 1;
    else if (!got) {
      if (nameKeys.has(norm)) nameOnly += 1;
      else miss.push({ word: surface, root: w.root, ref: w.ref });
    } else wrong.push({ word: surface, expected: w.root, got, ref: w.ref });
  }

  const collisions = [...claims.entries()]
    .filter(([, rootsFor]) => rootsFor.size > 1)
    .map(([key, rootsFor]) => ({
      key,
      roots: [...rootsFor.keys()],
      examples: [...rootsFor.values()].map((v) => `${v.word} (${v.ref})`),
      reachable: forms[key] ?? null,
    }))
    .sort((a, b) => b.roots.length - a.roots.length);

  const pct = (n: number) => `${((n / checked) * 100).toFixed(2)}%`;
  console.log("═══ SEARCH COVERAGE AUDIT ═══");
  console.log(`distinct surface words (root-bearing): ${checked}`);
  console.log(`  resolved to the corpus root : ${ok} (${pct(ok)})`);
  console.log(`  WRONG root                  : ${wrong.length} (${pct(wrong.length)})`);
  console.log(`  MISS (nothing resolves)     : ${miss.length} (${pct(miss.length)})`);
  console.log(`  unresolved but a known name : ${nameOnly}`);
  console.log(`normalization collisions (one key, several roots): ${collisions.length}`);

  console.log(`\n── WRONG ROOT (first ${limit}) — the UI answers, but with another word's root ──`);
  for (const r of wrong.slice(0, limit)) {
    console.log(`  ${r.word.padEnd(14)} ${r.ref.padEnd(8)} corpus=${r.expected.padEnd(6)} search=${r.got}`);
  }
  console.log(`\n── MISS (first ${limit}) ──`);
  for (const r of miss.slice(0, limit)) {
    console.log(`  ${r.word.padEnd(14)} ${r.ref.padEnd(8)} root=${r.root}`);
  }
  console.log(`\n── COLLISIONS (first ${limit}) — only "reachable" is findable by that spelling ──`);
  for (const c of collisions.slice(0, limit)) {
    console.log(`  ${c.key.padEnd(12)} roots=${c.roots.join(",").padEnd(22)} reachable=${c.reachable}`);
    console.log(`      ${c.examples.join("   ")}`);
  }

  if (jsonOut) {
    await fs.writeFile(jsonOut, JSON.stringify({ checked, ok, wrong, miss, collisions }, null, 2));
    console.log(`\nfull report → ${jsonOut}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
