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

