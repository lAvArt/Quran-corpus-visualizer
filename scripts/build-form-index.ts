/**
 * Precompute a surface-form → root index for home search.
 *
 * Maps every distinct Quranic word form (normalized, plus a proclitic-stripped
 * variant) to its triliteral root, so typing an inflected word — اسم / اسماء →
 * سمو, كتاب → كتب, الرحمن → رحم — resolves to the root's stats even though the
 * word isn't a bare root. Combined with the name index, this lets the home
 * search offer BOTH the root and any same-prefix name (اسم → سمو + إسماعيل).
 *
 * Emits `public/data/form-index.json` (~400 KB, lazy-loaded on first search).
 * Run: npx tsx scripts/build-form-index.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArabicForSearch, foldHamza } from "../lib/search/arabicNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC = path.join(ROOT_DIR, "public", "data", "quranic-corpus-morphology-0.4.txt");
const OUT = path.join(ROOT_DIR, "public", "data", "form-index.json");

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
// Leading proclitics the corpus splits off — stripped so a glued surface
// ("والرحمن") also resolves.
const PROCLITIC = /^(وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/;

async function main() {
  const text = await fs.readFile(SRC, "utf8");
  const lines = text.split(/\r?\n/);

  // Group segments into words; first root-bearing segment gives the word's root.
  const words = new Map<string, { surf: string; root: string | null }>();
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const m = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}:${m[3]}`;
    const root = feat((parts[3] ?? "").split("|").filter(Boolean), "ROOT");
    let w = words.get(key);
    if (!w) { w = { surf: "", root: null }; words.set(key, w); }
    w.surf += parts[1] ?? "";
    if (root && !w.root) w.root = bw2ar(root);
  }

  // form (normalized surface, + proclitic-stripped) → root (bare Arabic, exactly
  // as root-stats keys it). First occurrence wins.
  //
  // Two passes so DIRECT keys always beat hamza-dropped aliases: pass 1 keys the
  // literal spellings; pass 2 adds a ء-dropped alias (قرءان → قران) only where no
  // direct key exists, so a hamza-less query (قران/قرآن) reaches the قرءان entry
  // without ever overwriting a genuinely different word that was keyed directly.
  const out: Record<string, string> = {};
  const entries: { keys: string[]; root: string }[] = [];
  for (const w of words.values()) {
    if (!w.root) continue;
    const surface = normalizeArabicForSearch(bw2ar(w.surf));
    if (!surface) continue;
    const keys = new Set<string>([surface]);
    const stripped = surface.replace(PROCLITIC, "");
    if (stripped.length >= 2) keys.add(stripped);
    entries.push({ keys: [...keys], root: w.root });
    for (const f of keys) {
      if (f.length >= 2 && !(f in out)) out[f] = w.root;
    }
  }
  let aliasCount = 0;
  for (const { keys, root } of entries) {
    for (const k of keys) {
      const fh = foldHamza(k);
      if (fh.length >= 2 && fh !== k && !(fh in out)) {
        out[fh] = root;
        aliasCount += 1;
      }
    }
  }

  await fs.writeFile(OUT, JSON.stringify({ version: 1, forms: out }));
  const bytes = (await fs.stat(OUT)).size;
  console.log(`✅ form-index.json — ${Object.keys(out).length} forms (${aliasCount} hamza aliases) · ${(bytes / 1024).toFixed(0)} KB`);
  for (const q of ["اسم", "اسماء", "كتاب", "الرحمن", "قران", "قرءان", "القران"]) {
    console.log(`   ${q} → ${out[normalizeArabicForSearch(q)] ?? "—"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
