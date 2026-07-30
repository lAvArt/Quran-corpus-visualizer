/**
 * Precompute a per-name (root-LESS lemma) occurrence index for search.
 *
 * The Quranic Arabic Corpus gives proper nouns (Moses, Mary, Pharaoh, …) and
 * function words (من, إلى, حتى, …) a LEM but NO triliteral root, so they never
 * appear in `root-stats.json`. This reads the same morphology file and emits
 * `public/data/name-stats.json` — for every root-less word: occurrence count,
 * distinct sūrahs / verses / forms, first appearance, a 114-bar histogram, top
 * sūrahs and a POS breakdown — so a user can type a name (or any root-less
 * word) as-is and get the same "how often / where" card the roots already show.
 *
 * COUNTING — matches the live loader (lib/corpus/morphologyLoader.ts): a word's
 * "content lemma" is the LEM of the first segment that carries one, so a leading
 * proclitic (وَ / يٰ / بِ / لِ / ال) does NOT steal the word from its name. Words
 * are then grouped by the search-normalized display form, merging homograph
 * lemmas (e.g. مِن `min` + مَن `man` → the written word من) so the count is the
 * count of that written word. This is the single source of truth for name
 * counts; /search and the inspector re-derive the same number from the (fixed)
 * per-word token lemma.
 *
 * Run: npx tsx scripts/build-name-stats.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArabicForSearch } from "../lib/search/arabicNormalize";
import { NAME_GLOSSES } from "../lib/data/nameGlosses";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC = path.join(ROOT_DIR, "public", "data", "quranic-corpus-morphology-0.4.txt");
const OUT = path.join(ROOT_DIR, "public", "data", "name-stats.json");

// ── Buckwalter → Arabic (identical table to lib/corpus/morphologyLoader.ts) ──
const BW2AR: Record<string, string> = {
  "'": "ء", "|": "آ", ">": "أ", "<": "إ", "&": "ؤ", "}": "ئ", A: "ا", b: "ب",
  p: "ة", t: "ت", v: "ث", j: "ج", H: "ح", x: "خ", d: "د", "*": "ذ", r: "ر",
  z: "ز", s: "س", $: "ش", S: "ص", D: "ض", T: "ط", Z: "ظ", E: "ع", g: "غ",
  f: "ف", q: "ق", k: "ك", l: "ل", m: "م", n: "ن", h: "ه", w: "و", Y: "ى",
  y: "ي", F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ", "~": "ّ", o: "ْ",
  "`": "ٰ", "{": "ٱ",
};
const STRIP = new Set(["^", "@", "_", ".", ",", "2", "[", "]"]);
const DIACRITICS = /[ً-ْٰـ]/g; // harakat, dagger alif, tatweel

function bw2ar(input: string): string {
  let out = "";
  for (const ch of input) {
    if (STRIP.has(ch) || ch === "#") continue;
    out += BW2AR[ch] ?? ch;
  }
  return out;
}
/** Bare (diacritic-free) Arabic display form for a Buckwalter string. */
const displayForm = (bw: string): string => bw2ar(bw).replace(DIACRITICS, "");

const ROMAN: Record<string, string> = {
  "'": "ʾ", "|": "ā", ">": "ʾ", "<": "ʾ", "&": "ʾ", "}": "ʾ", A: "ā", b: "b",
  t: "t", v: "th", j: "j", H: "ḥ", x: "kh", d: "d", "*": "dh", r: "r", z: "z",
  s: "s", $: "sh", S: "ṣ", D: "ḍ", T: "ṭ", Z: "ẓ", E: "ʿ", g: "gh", f: "f",
  q: "q", k: "k", l: "l", m: "m", n: "n", h: "h", w: "w", Y: "ā", y: "y",
  a: "a", u: "u", i: "i", "`": "ā",
};
function romanize(bw: string): string {
  return Array.from(bw).map((c) => ROMAN[c] ?? "").join("");
}

function normalizePos(raw: string): string {
  const p = raw.toUpperCase();
  if (p.startsWith("V")) return "V";
  if (p === "ADJ") return "ADJ";
  if (p === "PRON" || p === "REL" || p === "DEM") return "PRON";
  if (["P", "CONJ", "DET", "REM", "INL", "VOC", "NEG", "INTG", "COND", "SUB", "RSLT", "T"].includes(p)) return "P";
  return "N";
}
function feat(tokens: string[], key: string): string | null {
  const t = tokens.find((x) => x.startsWith(`${key}:`));
  return t ? t.slice(key.length + 1) : null;
}

interface WordAgg {
  sura: number;
  ayah: number;
  word: number;
  formBw: string;        // concatenated segment surface forms (whole word)
  hasRoot: boolean;
  lemBw: string | null;  // content lemma = first segment that carries a LEM
  rawPos: string | null; // raw POS of that content segment
}

async function main() {
  const text = await fs.readFile(SRC, "utf8");
  const lines = text.split(/\r?\n/);

  // Group segments into words. Content lemma = first LEM-bearing segment, so a
  // leading proclitic (no LEM) never captures the word.
  const words = new Map<string, WordAgg>();
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const m = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!m) continue;
    const sura = +m[1], ayah = +m[2], word = +m[3];
    const key = `${sura}:${ayah}:${word}`;
    const form = parts[1] ?? "";
    const tokens = (parts[3] ?? "").split("|").filter(Boolean);
    const rootBw = feat(tokens, "ROOT");
    const lemBw = feat(tokens, "LEM");
    const posRaw = feat(tokens, "POS") ?? parts[2] ?? "N";
    let w = words.get(key);
    if (!w) {
      w = { sura, ayah, word, formBw: "", hasRoot: false, lemBw: null, rawPos: null };
      words.set(key, w);
    }
    w.formBw += form;
    if (rootBw) w.hasRoot = true;
    if (lemBw && w.lemBw === null) {
      w.lemBw = lemBw;
      w.rawPos = posRaw;
    }
  }

  // Per-ayah ordered words (normalized surface) — for compound phrase scanning.
  const ayahWords = new Map<string, { word: number; norm: string }[]>();
  for (const w of words.values()) {
    const k = `${w.sura}:${w.ayah}`;
    const arr = ayahWords.get(k) ?? [];
    arr.push({ word: w.word, norm: normalizeArabicForSearch(bw2ar(w.formBw)) });
    ayahWords.set(k, arr);
  }
  for (const arr of ayahWords.values()) arr.sort((a, b) => a.word - b.word);

  // Aggregate root-less words by their search-normalized display form, merging
  // homograph lemmas (min + man → من).
  interface Agg {
    key: string;
    display: string;
    count: number;
    surahs: Set<number>;
    verses: Set<string>;
    forms: Set<string>;
    hist: number[];
    first: { sura: number; ayah: number; word: number } | null;
    firstAyahBySura: Map<number, number>;
    pos: Record<string, number>;
    lems: Set<string>;          // raw Buckwalter LEMs merged here
    isPN: boolean;
    // dominant lemma (highest single-lemma contribution) for display/translit
    lemCount: Map<string, number>;
  }
  const agg = new Map<string, Agg>();
  let rootlessWords = 0;
  for (const w of words.values()) {
    if (w.hasRoot || !w.lemBw) continue;
    rootlessWords++;
    const display = displayForm(w.lemBw);
    const key = normalizeArabicForSearch(display);
    if (!key) continue;
    let a = agg.get(key);
    if (!a) {
      a = {
        key, display, count: 0, surahs: new Set(), verses: new Set(), forms: new Set(),
        hist: new Array(115).fill(0), first: null, firstAyahBySura: new Map(), pos: {}, lems: new Set(), isPN: false,
        lemCount: new Map(),
      };
      agg.set(key, a);
    }
    a.count++;
    a.surahs.add(w.sura);
    a.verses.add(`${w.sura}:${w.ayah}`);
    if (w.formBw) a.forms.add(bw2ar(w.formBw));
    if (w.sura >= 1 && w.sura <= 114) a.hist[w.sura]++;
    if (!a.firstAyahBySura.has(w.sura)) a.firstAyahBySura.set(w.sura, w.ayah);
    const pos = normalizePos(w.rawPos ?? "N");
    a.pos[pos] = (a.pos[pos] ?? 0) + 1;
    a.lems.add(w.lemBw);
    a.lemCount.set(w.lemBw, (a.lemCount.get(w.lemBw) ?? 0) + 1);
    if (w.rawPos === "PN") a.isPN = true;
    const earlier = !a.first || w.sura < a.first.sura ||
      (w.sura === a.first.sura && (w.ayah < a.first.ayah ||
        (w.ayah === a.first.ayah && w.word < a.first.word)));
    if (earlier) a.first = { sura: w.sura, ayah: w.ayah, word: w.word };
  }

  interface OutEntry {
    kind: "name" | "word";
    key: string;              // normalizeArabicForSearch(display) — the lookup key
    root: string;             // plain display form (e.g. "موسى") — ResultPanel title
    bare: string;             // same as root (kept for RootStat shape parity)
    bw: string;               // dominant Buckwalter LEM
    lemma: string;            // vocalized Arabic of dominant LEM (for display/routing)
    translit: string;
    gloss: string | null;
    /** Latin spelling variants (from NAME_GLOSSES.aliases) for the term index. */
    latinAliases?: string[];
    count: number;
    surahs: number;
    verses: number;
    forms: number;
    first: { sura: number; ayah: number } | null;
    /** First occurrence location for deep-link focus. */
    rep: { sura: number; ayah: number; word: number } | null;
    top: [number, number, number][];
    hist: number[];
    pos: [string, number][];
    /** Compound occurrence refs [sura, ayah, wordStart, len] (compounds only). */
    occ?: [number, number, number, number][];
  }

  const out: Record<string, OutEntry> = {};
  // Alternate Arabic spelling → canonical entry key. Covers manual aliases plus
  // an auto medial dagger-alif → alif variant (e.g. سُلَيْمَٰن → سليمان) so the
  // full-alif spelling a user types resolves.
  const aliasIndex: Record<string, string> = {};
  const isArabic = (s: string) => /[؀-ۿ]/.test(s);
  const addAlias = (raw: string, entryKey: string) => {
    const k = normalizeArabicForSearch(raw);
    if (k && k !== entryKey && !out[k] && !aliasIndex[k]) aliasIndex[k] = entryKey;
  };
  const missingGloss: string[] = [];
  for (const a of agg.values()) {
    // Dominant lemma = the LEM contributing the most occurrences in this bucket.
    let domLem: string | undefined;
    let domN = -1;
    for (const [lem, n] of a.lemCount) {
      if (n > domN) { domN = n; domLem = lem; }
    }
    domLem = domLem ?? [...a.lems][0] ?? "";
    // Gloss/translit/aliases: gather from every curated lemma merged here.
    let gloss: string | null = null;
    let translit = "";
    const arAliases: string[] = [];
    const latinAliases: string[] = [];
    for (const lem of a.lems) {
      const g = NAME_GLOSSES.get(lem);
      if (!g) continue;
      if (!gloss) { gloss = g.en; translit = g.translit; }
      for (const al of g.aliases ?? []) (isArabic(al) ? arAliases : latinAliases).push(al);
    }
    if (!translit) translit = romanize(domLem);
    if (a.isPN && !gloss) missingGloss.push(`${domLem} (${a.display})`);
    // Auto medial dagger-alif → alif variant (سُلَيْمَٰن → سليمان). A dagger alif
    // (U+0670) after a consonant is a written long-ā that users spell with ا;
    // one after ى/ا/و is word-final (مُوسَىٰ) and already normalizes correctly.
    const domVocalized = bw2ar(domLem);
    if (/[^ىاو]ٰ/.test(domVocalized)) {
      arAliases.push(domVocalized.replace(/(?<=[^ىاو])ٰ/g, "ا"));
    }

    const hist = a.hist.slice(1, 115);
    const top = hist
      .map((c, i) => [i + 1, c] as [number, number])
      .filter(([, c]) => c > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([s, c]) => [s, c, a.firstAyahBySura.get(s) ?? 0] as [number, number, number]);
    const pos = Object.entries(a.pos).sort((x, y) => y[1] - x[1]) as [string, number][];
    out[a.key] = {
      kind: a.isPN ? "name" : "word",
      key: a.key,
      root: a.display,
      bare: a.display,
      bw: domLem,
      lemma: bw2ar(domLem),
      translit,
      gloss,
      latinAliases: latinAliases.length ? [...new Set(latinAliases)] : undefined,
      count: a.count,
      surahs: a.surahs.size,
      verses: a.verses.size,
      forms: a.forms.size,
      first: a.first ? { sura: a.first.sura, ayah: a.first.ayah } : null,
      rep: a.first ? { sura: a.first.sura, ayah: a.first.ayah, word: a.first.word } : null,
      top,
      hist,
      pos,
    };
    for (const al of arAliases) addAlias(al, a.key);
  }

  // ── Compound proper nouns (multi-word entities the corpus has no single
  //    lemma for) — counted by scanning consecutive words for the phrase. ──
  // `scan` = the ALREADY-normalized corpus word forms to match consecutively
  //   (length 1 = a single distinctive anchor word). Kept separate from the
  //   `display` label because corpus surfaces inflect / carry proclitics
  //   (ذو→ذي, أصحاب→اصحب dagger-alif, إسرائيل→اسرءيل) that a clean label doesn't.
  const COMPOUNDS: Array<{ scan: string[]; display: string; en: string; translit: string }> = [
    { scan: ["القرنين"], display: "ذو القرنين", en: "Dhul-Qarnayn", translit: "Dhū al-Qarnayn" },
    { scan: ["بني", "اسرءيل"], display: "بني إسرائيل", en: "Children of Israel", translit: "Banū Isrāʾīl" },
    { scan: ["اصحب", "الكهف"], display: "أصحاب الكهف", en: "People of the Cave (Aṣḥāb al-Kahf)", translit: "Aṣḥāb al-Kahf" },
    { scan: ["ياجوج", "وماجوج"], display: "يأجوج ومأجوج", en: "Gog and Magog", translit: "Yaʾjūj wa-Maʾjūj" },
  ];
  for (const c of COMPOUNDS) {
    const key = normalizeArabicForSearch(c.display);
    if (out[key]) continue;
    const tokens = c.scan;
    const surahs = new Set<number>();
    const verses = new Set<string>();
    const hist = new Array(115).fill(0);
    let count = 0;
    let first: { sura: number; ayah: number; word: number } | null = null;
    // Occurrence refs [sura, ayah, wordStart, len] — the carousel fetches these
    // ayahs' text and highlights the matched word span (compounds have no single
    // lemma to query the corpus by).
    const occ: [number, number, number, number][] = [];
    for (const [ayahKey, ws] of ayahWords) {
      const [sura, ayah] = ayahKey.split(":").map(Number);
      for (let i = 0; i + tokens.length <= ws.length; i++) {
        let match = true;
        for (let j = 0; j < tokens.length; j++) {
          if (ws[i + j].norm !== tokens[j]) { match = false; break; }
        }
        if (!match) continue;
        count++;
        surahs.add(sura);
        verses.add(`${sura}:${ayah}`);
        if (sura >= 1 && sura <= 114) hist[sura]++;
        if (occ.length < 11) occ.push([sura, ayah, ws[i].word, tokens.length]);
        const loc = { sura, ayah, word: ws[i].word };
        if (!first || sura < first.sura ||
          (sura === first.sura && (ayah < first.ayah ||
            (ayah === first.ayah && loc.word < first.word)))) first = loc;
      }
    }
    if (count === 0) { console.log(`   ⚠ compound "${c.display}" not found — skipped`); continue; }
    const firstAyahBySura = new Map<number, number>();
    for (const [s, a] of occ) if (!firstAyahBySura.has(s)) firstAyahBySura.set(s, a);
    const h = hist.slice(1, 115);
    const top = h.map((v, i) => [i + 1, v] as [number, number])
      .filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([s, v]) => [s, v, firstAyahBySura.get(s) ?? 0] as [number, number, number]);
    out[key] = {
      kind: "name", key, root: c.display, bare: c.display, bw: "", lemma: c.display,
      translit: c.translit, gloss: c.en, count, surahs: surahs.size, verses: verses.size,
      forms: 1, first: first ? { sura: first.sura, ayah: first.ayah } : null,
      rep: first, top, hist: h, pos: [["N", count]], occ,
    };
  }

  // Featured = the named proper nouns, frequency-ranked (chips / suggestions).
  const featured = Object.values(out)
    .filter((e) => e.kind === "name")
    .sort((x, y) => y.count - x.count)
    .slice(0, 24)
    .map((e) => e.key);

  const nameCount = Object.values(out).filter((e) => e.kind === "name").length;
  const payload = { version: 2, entryCount: Object.keys(out).length, nameCount, aliasIndex, featured, names: out };
  await fs.writeFile(OUT, JSON.stringify(payload));
  const bytes = (await fs.stat(OUT)).size;
  console.log(
    `✅ name-stats.json — ${Object.keys(out).length} entries (${nameCount} proper nouns) · ` +
    `${Object.keys(aliasIndex).length} aliases · ${rootlessWords} root-less words · ${(bytes / 1024).toFixed(0)} KB`,
  );
  if (missingGloss.length) {
    console.log(`   ⚠ ${missingGloss.length} proper-noun lemma(s) without a NAME_GLOSSES entry:`);
    console.log(`     ${missingGloss.join(", ")}`);
  }
  const sample = ["موسى", "عيسى", "محمد", "ابراهيم", "اسماعيل", "مريم"];
  for (const s of sample) {
    const k = normalizeArabicForSearch(s);
    const e = out[k];
    console.log(`   ${s} → ${e ? `${e.count} occurrences · ${e.surahs} sūrahs · gloss=${e.gloss}` : "MISSING"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
