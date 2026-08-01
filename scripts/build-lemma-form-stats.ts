/**
 * Precompute per-LEMMA and per-FORM stats for the home-search "exact match"
 * drill-down (root → lemma → form).
 *
 * The default home search resolves a word to its ROOT and counts every
 * derivative (عزيز, عزّة, يعزّ … all under عزز). This index lets the user narrow
 * to the specific LEMMA (the word + its inflections: عزيز, عزيزًا, العزيز) or the
 * exact surface FORM, with a real occurrence count + a verse carousel for each.
 *
 * Counts are token occurrences (matching root-stats). `refs` are DISTINCT ayahs
 * (first matching word position each), capped — enough to fill the carousel; the
 * client renders them through the existing `/api/corpus/occurrences?refs=` path,
 * so no DB column or API change is needed. (No per-sūrah "top" breakdown is
 * stored — the drill-down panel shows count + carousel; the sūrah distribution
 * stays a root-level view — which keeps this file lean.)
 *
 * Emits `public/data/lemma-form-stats.json` (lazy-loaded on first drill-down).
 * Run: npx tsx scripts/build-lemma-form-stats.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArabicForSearch } from "../lib/search/arabicNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC = path.join(ROOT_DIR, "public", "data", "quranic-corpus-morphology-0.4.txt");
const OUT = path.join(ROOT_DIR, "public", "data", "lemma-form-stats.json");

const BW2AR: Record<string, string> = {
  "'": "ء", "|": "آ", ">": "أ", "<": "إ", "&": "ؤ", "}": "ئ", A: "ا", b: "ب",
  p: "ة", t: "ت", v: "ث", j: "ج", H: "ح", x: "خ", d: "د", "*": "ذ", r: "ر",
  z: "ز", s: "س", $: "ش", S: "ص", D: "ض", T: "ط", Z: "ظ", E: "ع", g: "غ",
  f: "ف", q: "ق", k: "ك", l: "ل", m: "م", n: "ن", h: "ه", w: "و", Y: "ى",
  y: "ي", F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ", "~": "ّ", o: "ْ",
  "`": "ٰ", "{": "ٱ",
};
const STRIP = new Set(["^", "@", "_", ".", ",", "2", "[", "]", "#"]);
function bw2ar(input: string): string {
  let out = "";
  for (const ch of input) { if (!STRIP.has(ch)) out += BW2AR[ch] ?? ch; }
  return out;
}
function feat(tokens: string[], key: string): string | null {
  const t = tokens.find((x) => x.startsWith(`${key}:`));
  return t ? t.slice(key.length + 1) : null;
}

const REF_CAP = 10; // distinct ayahs kept per entry (carousel shows ≤10)

interface Entry {
  d: string; // display (Arabic, with diacritics)
  c: number; // occurrence count (tokens)
  r: string | null; // bare root
  l?: string | null; // normalized lemma key (forms only — links form → lemma)
  refs: [number, number, number][]; // distinct-ayah [sura, ayah, word]
  seenAyah: Set<string>;
}

function makeEntry(d: string, r: string | null, l?: string | null): Entry {
  return { d, c: 0, r, l, refs: [], seenAyah: new Set() };
}
function record(e: Entry, sura: number, ayah: number, word: number) {
  e.c += 1;
  const ak = `${sura}:${ayah}`;
  if (!e.seenAyah.has(ak) && e.refs.length < REF_CAP) {
    e.seenAyah.add(ak);
    e.refs.push([sura, ayah, word]);
  }
}
function serialize(e: Entry) {
  const out: Record<string, unknown> = { d: e.d, c: e.c, refs: e.refs };
  if (e.r) out.r = e.r;
  if (e.l) out.l = e.l;
  return out;
}

async function main() {
  const text = await fs.readFile(SRC, "utf8");
  const lines = text.split(/\r?\n/);

  // Reconstruct whole words from their segments: concatenated surface, plus the
  // word's content root/lemma (first ROOT/LEM-bearing segment wins, mirroring
  // the app's content-lemma rule).
  const words = new Map<
    string,
    { sura: number; ayah: number; word: number; surf: string; root: string | null; lemma: string | null }
  >();
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const m = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}:${m[3]}`;
    const feats = (parts[3] ?? "").split("|").filter(Boolean);
    const root = feat(feats, "ROOT");
    const lemma = feat(feats, "LEM");
    let w = words.get(key);
    if (!w) {
      w = { sura: Number(m[1]), ayah: Number(m[2]), word: Number(m[3]), surf: "", root: null, lemma: null };
      words.set(key, w);
    }
    w.surf += parts[1] ?? "";
    if (root && !w.root) w.root = bw2ar(root);
    if (lemma && !w.lemma) w.lemma = bw2ar(lemma);
  }

  const forms = new Map<string, Entry>();
  const lemmas = new Map<string, Entry>();
  for (const w of words.values()) {
    const surfDisplay = bw2ar(w.surf);
    const formKey = normalizeArabicForSearch(surfDisplay);
    const lemDisplay = w.lemma ?? "";
    const lemKey = lemDisplay ? normalizeArabicForSearch(lemDisplay) : "";

    if (formKey.length >= 2) {
      let fe = forms.get(formKey);
      if (!fe) { fe = makeEntry(surfDisplay, w.root, lemKey || null); forms.set(formKey, fe); }
      record(fe, w.sura, w.ayah, w.word);
    }
    if (lemKey.length >= 2) {
      let le = lemmas.get(lemKey);
      if (!le) { le = makeEntry(lemDisplay, w.root); lemmas.set(lemKey, le); }
      record(le, w.sura, w.ayah, w.word);
    }
  }

  const formsOut: Record<string, unknown> = {};
  for (const [k, e] of forms) formsOut[k] = serialize(e);
  const lemmasOut: Record<string, unknown> = {};
  for (const [k, e] of lemmas) lemmasOut[k] = serialize(e);

  await fs.writeFile(OUT, JSON.stringify({ version: 1, forms: formsOut, lemmas: lemmasOut }));
  const bytes = (await fs.stat(OUT)).size;
  console.log(
    `✅ lemma-form-stats.json — ${lemmas.size} lemmas · ${forms.size} forms · ${(bytes / 1024).toFixed(0)} KB`,
  );
  for (const q of ["عزيز", "العزيز", "صالح", "موسي"]) {
    const nk = normalizeArabicForSearch(q);
    const f = forms.get(nk);
    const l = lemmas.get(nk);
    console.log(`   ${q}: form=${f ? `${f.d} ×${f.c}` : "—"} · lemma=${l ? `${l.d} ×${l.c}` : "—"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
