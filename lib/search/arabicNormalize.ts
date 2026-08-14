export const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
export const TATWEEL_RE = /\u0640/g;

const WEAK_FINAL_ROOT_CHARS = new Set(["ا", "ى", "ي", "و"]);
const COMMON_SUFFIXES = [
  "كما",
  "كم",
  "كن",
  "هما",
  "هم",
  "هن",
  "نا",
  "ها",
  "ه",
  "ك",
  "ي",
];

export function normalizeArabicForSearch(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

/**
 * Bridge the alef-madda (آ = hamza+alef) to the corpus's explicit hamza-alef
 * spelling. The corpus is inconsistent: some words are written with a real
 * hamza (قرآن → قُرْءَان, i.e. ء+ا) while others use the madda (مآب). A plain
 * query with آ normalizes (NFKD strips the madda) to a bare alef — قرآن → قران
 * — which misses the قرءان key. Rewriting آ → ء+ا on the RAW string, before
 * normalization, produces the قرءان form. Applied only as an EXTRA variant
 * (see searchKeyVariants), so the madda-spelled words (مآب) still resolve.
 */
export function foldMaddaToHamzaAlef(value: string): string {
  // Composed آ (آ) and decomposed alef+maddah (آ) → ء+ا.
  return value
    .replace(/آ/g, "ءا")
    .replace(/آ/g, "ءا");
}

/**
 * Normalized key(s) to try for a search query: the plain normalization first,
 * then the hamza-alef bridge (see foldMaddaToHamzaAlef) when it differs — so a
 * lookup can try both the ا- and ءا-spellings of a madda word. Deduped.
 */
export function searchKeyVariants(query: string): string[] {
  const base = normalizeArabicForSearch(query);
  const bridged = normalizeArabicForSearch(foldMaddaToHamzaAlef(query));
  return bridged && bridged !== base ? [base, bridged] : base ? [base] : [];
}

/**
 * Fold a modern (imlāʾī) spelling toward the corpus's Uthmani rasm by dropping
 * the MEDIAL long-alef — the letter the rasm most commonly omits (صالح is
 * written صلح, الصالحين → الصلحين, رحمان → رحمن). Keeps the first and last
 * letters so a leading article/hamza-alif or a genuine final alef survives.
 * Callers use it as a FALLBACK after a direct lookup misses, so an over-fold
 * that matches nothing is harmless. Expects an already-normalized key.
 */
export function foldRasmAlef(normalized: string): string {
  if (normalized.length <= 2) return normalized;
  return normalized[0] + normalized.slice(1, -1).replace(/ا/g, "") + normalized[normalized.length - 1];
}

export function normalizeRootFamily(value: string): string {
  const normalized = normalizeArabicForSearch(value);
  if (!normalized) return normalized;
  const chars = [...normalized];
  const last = chars[chars.length - 1];
  if (last && WEAK_FINAL_ROOT_CHARS.has(last)) {
    chars[chars.length - 1] = "ي";
  }
  return chars.join("");
}

export function buildLemmaCandidates(value: string): Set<string> {
  const base = normalizeArabicForSearch(value);
  const candidates = new Set<string>();
  if (!base) return candidates;
  candidates.add(base);

  if (base.startsWith("ال") && base.length > 3) {
    candidates.add(base.slice(2));
  }

  for (const suffix of COMMON_SUFFIXES) {
    if (base.length > suffix.length + 1 && base.endsWith(suffix)) {
      candidates.add(base.slice(0, -suffix.length));
    }
  }

  return candidates;
}

