import type { PartOfSpeech } from "@/lib/schema/types";

export interface ParsedSearchQuery {
  raw: string;
  freeText: string;
  root?: string;
  lemma?: string;
  pos?: PartOfSpeech;
  ayah?: string;
  text?: string;
  gloss?: string;
}

const POS_ALIASES: Record<string, PartOfSpeech> = {
  n: "N",
  noun: "N",
  v: "V",
  verb: "V",
  p: "P",
  particle: "P",
  adj: "ADJ",
  adjective: "ADJ",
  pron: "PRON",
  pronoun: "PRON",
};

const FIELD_ALIASES: Record<string, keyof Omit<ParsedSearchQuery, "raw" | "freeText">> = {
  root: "root",
  r: "root",
  lemma: "lemma",
  l: "lemma",
  pos: "pos",
  p: "pos",
  ayah: "ayah",
  a: "ayah",
  text: "text",
  t: "text",
  gloss: "gloss",
  g: "gloss",
};

export function parseSearchQuery(rawInput: string): ParsedSearchQuery {
  const raw = rawInput.trim();
  const out: ParsedSearchQuery = { raw, freeText: "" };
  if (!raw) return out;

  const chunks = raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/^[+~|]+|[+~|]+$/g, ""))
    .filter(Boolean);

  const leftover: string[] = [];
  for (const chunk of chunks) {
    const idx = chunk.indexOf(":");
    if (idx <= 0) {
      leftover.push(chunk);
      continue;
    }
    const fieldRaw = chunk.slice(0, idx).toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (!value) continue;

    const field = FIELD_ALIASES[fieldRaw];
    if (!field) {
      leftover.push(chunk);
      continue;
    }

    if (field === "pos") {
      const mapped = POS_ALIASES[value.toLowerCase()];
      if (mapped) out.pos = mapped;
      continue;
    }

    (out[field] as string | undefined) = value;
  }

  out.freeText = leftover.join(" ").trim();
  return out;
}

