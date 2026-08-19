/**
 * Precompute a compact per-root statistics index for the minimal home screen.
 *
 * Reads the full Quranic Arabic Corpus morphology file and emits
 * `public/data/root-stats.json` — for every root: occurrence count, distinct
 * sūrahs / verses / word-forms, first appearance, a 114-bar per-sūrah histogram,
 * the top sūrahs, a POS breakdown, plus the curated English gloss and a simple
 * romanization. This lets the landing page show real "how often / where" data
 * without shipping or loading the 6 MB corpus.
 *
 * Run: npx tsx scripts/build-root-stats.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT_GLOSSES } from "../lib/data/rootGlosses";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC = path.join(ROOT_DIR, "public", "data", "quranic-corpus-morphology-0.4.txt");
const OUT = path.join(ROOT_DIR, "public", "data", "root-stats.json");

/** Verses baked per featured root. Keep in step with the live carousel's
 *  `fetchOccurrences(..., 10)` in components/home/MinimalHome.tsx. */
const EXAMPLES_PER_ROOT = 10;

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

function bw2ar(input: string): string {
  let out = "";
  for (const ch of input) {
    if (STRIP.has(ch) || ch === "#") continue;
    out += BW2AR[ch] ?? ch;
  }
  return out;
}

// Romanization of a root's consonantal skeleton (display stand-in for translit).
const ROMAN: Record<string, string> = {
  "'": "ʾ", "|": "ā", ">": "ʾ", "<": "ʾ", "&": "ʾ", "}": "ʾ", A: "ā", b: "b",
  t: "t", v: "th", j: "j", H: "ḥ", x: "kh", d: "d", "*": "dh", r: "r", z: "z",
  s: "s", $: "sh", S: "ṣ", D: "ḍ", T: "ṭ", Z: "ẓ", E: "ʿ", g: "gh", f: "f",
  q: "q", k: "k", l: "l", m: "m", n: "n", h: "h", w: "w", Y: "ā", y: "y",
};
function romanizeRoot(bw: string): string {
  return Array.from(bw)
    .map((c) => ROMAN[c])
    .filter(Boolean)
    .join(" · ");
}

/**
 * Root-consonant normalization: inside a root string, every alif / hamza
 * carrier stands for the hamza consonant. Folding them joins QAC roots
 * (e.g. "امن" from Buckwalter `Amn`) with curated gloss keys ("ءمن").
 */
const normRoot = (s: string) => s.replace(/[اأإآٱئؤ]/g, "ء");

const GLOSS_BY_NORM = new Map<string, string>();
for (const [k, v] of ROOT_GLOSSES) {
  const n = normRoot(k);
  if (!GLOSS_BY_NORM.has(n)) GLOSS_BY_NORM.set(n, v);
}
// High-frequency roots the curated map misses or spells differently.
const EXTRA_GLOSSES: [string, string][] = [
  ["اله", "God / deity"],
  ["قرء", "to read / recite"],
  ["وحي", "to reveal / inspire"],
  ["دين", "religion / judgment / debt"],
  ["شهد", "to witness / testify"],
  ["نعم", "blessing / favor"],
  ["فضل", "bounty / favor"],
  ["وقي", "to protect / piety"],
  ["خوف", "fear"],
  ["دنو", "near / this world"],
  ["ذهب", "to go / gold"],
  ["جيء", "to come"],
  ["رود", "to will / intend"],
  ["تلو", "to recite / follow"],
  ["بعث", "to raise / resurrect / send"],
  ["حشر", "to gather / assemble"],
  ["خلد", "to abide forever / eternal"],
  ["حفظ", "to guard / preserve"],
  ["غيب", "unseen / hidden"],
  ["كبر", "great / to magnify"],
  ["عظم", "great / mighty / bone"],
  ["برك", "blessing"],
  ["عزز", "might / honor"],
  ["حسن", "good / beauty"],
  ["سوء", "evil / bad"],
  ["جزي", "recompense / reward"],
  ["حسب", "account / reckoning"],
  ["مثل", "example / likeness"],
  ["قصص", "story / to narrate"],
  ["ريب", "doubt"],
  ["يقن", "certainty"],
  ["كثر", "many / abundance"],
  ["قلل", "few / little"],
  ["قوو", "strength / power"],
  ["علو", "high / exalted"],
];
for (const [k, v] of EXTRA_GLOSSES) {
  const n = normRoot(k);
  if (!GLOSS_BY_NORM.has(n)) GLOSS_BY_NORM.set(n, v);
}

const glossFor = (bare: string): string | null =>
  ROOT_GLOSSES.get(bare) ?? GLOSS_BY_NORM.get(normRoot(bare)) ?? null;

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
  forms: string[];
  rootBw: string | null;
  lemBw: string | null;
  pos: string;
}

async function main() {
  const text = await fs.readFile(SRC, "utf8");
  const lines = text.split(/\r?\n/);

  // Group segments into words (one root-bearing word per sura:ayah:word).
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
    const pos = normalizePos(feat(tokens, "POS") ?? parts[2] ?? "N");
    let w = words.get(key);
    if (!w) {
      w = { sura, ayah, word, forms: [], rootBw: null, lemBw: null, pos };
      words.set(key, w);
    }
    w.forms.push(form);
    if (rootBw && !w.rootBw) {
      w.rootBw = rootBw;
      w.lemBw = lemBw;
      w.pos = pos;
    }
  }

  // Aggregate per root.
  interface Agg {
    count: number;
    surahs: Set<number>;
    verses: Set<string>;
    forms: Set<string>; // distinct lemmas (dictionary "word forms")
    hist: number[];
    first: { sura: number; ayah: number; word: number } | null;
    /** First ayah of occurrence per sūrah — lets a top-sūrah chip show a
     *  verse ref when the root occurs there just once. */
    firstAyahBySura: Map<number, number>;
    pos: Record<string, number>;
  }
  // Ayah → its words (to reconstruct example verses), and per-root occurrences.
  const byAyah = new Map<string, WordAgg[]>();
  for (const w of words.values()) {
    const k = `${w.sura}:${w.ayah}`;
    const arr = byAyah.get(k);
    if (arr) arr.push(w);
    else byAyah.set(k, [w]);
  }
  const rootOccs = new Map<string, [number, number, number][]>();

  const roots = new Map<string, Agg>();
  for (const w of words.values()) {
    if (!w.rootBw) continue;
    const occ = rootOccs.get(w.rootBw);
    if (occ) occ.push([w.sura, w.ayah, w.word]);
    else rootOccs.set(w.rootBw, [[w.sura, w.ayah, w.word]]);
    let a = roots.get(w.rootBw);
    if (!a) {
      a = { count: 0, surahs: new Set(), verses: new Set(), forms: new Set(), hist: new Array(115).fill(0), first: null, firstAyahBySura: new Map(), pos: {} };
      roots.set(w.rootBw, a);
    }
    a.count++;
    a.surahs.add(w.sura);
    a.verses.add(`${w.sura}:${w.ayah}`);
    if (w.lemBw) a.forms.add(bw2ar(w.lemBw));
    if (w.sura >= 1 && w.sura <= 114) a.hist[w.sura]++;
    if (!a.firstAyahBySura.has(w.sura)) a.firstAyahBySura.set(w.sura, w.ayah);
    a.pos[w.pos] = (a.pos[w.pos] ?? 0) + 1;
    const earlier = !a.first || w.sura < a.first.sura || (w.sura === a.first.sura && (w.ayah < a.first.ayah || (w.ayah === a.first.ayah && w.word < a.first.word)));
    if (earlier) a.first = { sura: w.sura, ayah: w.ayah, word: w.word };
  }

  // Emit.
  interface ExampleWord {
    t: string;
    root: string;
    pos: string;
  }
  interface Example {
    s: number;
    a: number;
    w: number;
    words: ExampleWord[];
  }
  interface OutEntry {
    root: string;
    bare: string;
    bw: string;
    translit: string;
    gloss: string | null;
    count: number;
    surahs: number;
    verses: number;
    forms: number;
    first: { sura: number; ayah: number } | null;
    top: [number, number, number][];
    hist: number[];
    pos: [string, number][];
    examples?: Example[];
  }
  const out: Record<string, OutEntry> = {};
  for (const [bw, a] of roots) {
    const bare = bw2ar(bw);
    if (!bare) continue;
    const hist = a.hist.slice(1, 115); // sura 1..114
    const top = hist
      .map((c, i) => [i + 1, c] as [number, number])
      .filter(([, c]) => c > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([s, c]) => [s, c, a.firstAyahBySura.get(s) ?? 0] as [number, number, number]);
    const pos = Object.entries(a.pos).sort((x, y) => y[1] - x[1]) as [string, number][];
    out[bare] = {
      root: Array.from(bare).join("-"),
      bare,
      bw,
      translit: romanizeRoot(bw),
      gloss: glossFor(bare),
      count: a.count,
      surahs: a.surahs.size,
      verses: a.verses.size,
      forms: a.forms.size,
      first: a.first ? { sura: a.first.sura, ayah: a.first.ayah } : null,
      top,
      hist,
      pos,
    };
  }

  // Featured = glossed roots ranked by frequency (for chips + "today's root").
  const featured = Object.values(out)
    .filter((r) => Boolean(r.gloss))
    .sort((x, y) => y.count - x.count)
    .slice(0, 48)
    .map((r) => r.bare);

  // Example verses (one per distinct sūrah, up to EXAMPLES_PER_ROOT) for each
  // featured root — the "today's root" carousel reconstructs the verse and
  // highlights the root word. Matches the live search result's carousel depth
  // (`fetchOccurrences(..., 10)`), so both surfaces promise the same ten.
  for (const bare of featured) {
    const entry = out[bare];
    const occs = (rootOccs.get(entry.bw) ?? []).slice().sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const seen = new Set<number>();
    const examples: Example[] = [];
    for (const [s, av, wd] of occs) {
      if (seen.has(s)) continue;
      seen.add(s);
      const ws = (byAyah.get(`${s}:${av}`) ?? []).slice().sort((x, y) => x.word - y.word);
      const wordsOut = ws
        .map((x) => ({ t: bw2ar(x.forms.join("")), root: x.rootBw ? bw2ar(x.rootBw) : "", pos: x.pos }))
        .filter((x) => x.t);
      if (wordsOut.length) examples.push({ s, a: av, w: wd, words: wordsOut });
      if (examples.length >= EXAMPLES_PER_ROOT) break;
    }
    entry.examples = examples;
  }

  const payload = { version: 1, rootCount: Object.keys(out).length, featured, roots: out };
  await fs.writeFile(OUT, JSON.stringify(payload));
  const bytes = (await fs.stat(OUT)).size;
  console.log(`✅ root-stats.json — ${Object.keys(out).length} roots · ${featured.length} featured · ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`   featured sample: ${featured.slice(0, 8).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
