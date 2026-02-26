import fs from "node:fs";
import path from "node:path";
import { sampleTokens } from "@/lib/corpus/sampleCorpus";
import { buildPhaseOneIndexes, queryPhaseOne } from "@/lib/search/indexes";
import { normalizeArabicForSearch } from "@/lib/search/arabicNormalize";
import { parseSearchQuery } from "@/lib/search/queryParser";
import type { CorpusToken } from "@/lib/schema/types";

interface BenchmarkCase {
  id: string;
  query: string;
  expectedTokenIds: string[];
}

interface BenchmarkConfig {
  dataset: string;
  version: number;
  topK: number;
  thresholds: {
    precisionAtK: number;
    recallAtK: number;
    mrr: number;
  };
  cases: BenchmarkCase[];
}

interface CaseMetrics {
  id: string;
  precision: number;
  recall: number;
  rr: number;
  retrieved: string[];
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function resolveConfigPath(): string {
  const fromArg = argValue("--file");
  if (fromArg) return path.resolve(process.cwd(), fromArg);
  return path.resolve(process.cwd(), "data/search-benchmark.sample.json");
}

function loadConfig(filePath: string): BenchmarkConfig {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as BenchmarkConfig;
}

function runFreeText(tokens: CorpusToken[], query: string): Set<string> {
  const q = query.trim();
  const qNorm = normalizeArabicForSearch(q);
  const qGloss = q.toLowerCase();
  const ids = new Set<string>();

  for (const token of tokens) {
    const rootNorm = normalizeArabicForSearch(token.root);
    const lemmaNorm = normalizeArabicForSearch(token.lemma);
    const textNorm = normalizeArabicForSearch(token.text);
    const gloss = token.morphology.gloss?.toLowerCase() ?? "";

    if (
      token.root.includes(q) ||
      token.lemma.includes(q) ||
      token.text.includes(q) ||
      rootNorm.includes(qNorm) ||
      lemmaNorm.includes(qNorm) ||
      textNorm.includes(qNorm) ||
      (qGloss.length > 1 && gloss.includes(qGloss))
    ) {
      ids.add(token.id);
    }
  }

  return ids;
}

function runQuery(tokens: CorpusToken[], query: string): string[] {
  const parsed = parseSearchQuery(query);
  const index = buildPhaseOneIndexes(tokens);

  let ids: Set<string>;
  if (parsed.root || parsed.lemma || parsed.pos || parsed.ayah) {
    ids = queryPhaseOne(index, {
      root: parsed.root,
      lemma: parsed.lemma,
      pos: parsed.pos,
      ayah: parsed.ayah,
    });
    if (parsed.freeText) {
      const extra = runFreeText(tokens, parsed.freeText);
      ids = new Set([...ids].filter((id) => extra.has(id)));
    }
  } else {
    ids = runFreeText(tokens, parsed.raw);
  }

  // Stable ranking by corpus order
  return tokens.filter((t) => ids.has(t.id)).map((t) => t.id);
}

function evaluateCase(tokens: CorpusToken[], c: BenchmarkCase, topK: number): CaseMetrics {
  const ranked = runQuery(tokens, c.query).slice(0, topK);
  const expected = new Set(c.expectedTokenIds);

  let tp = 0;
  let rr = 0;
  for (let i = 0; i < ranked.length; i++) {
    const tokenId = ranked[i];
    if (expected.has(tokenId)) {
      tp++;
      if (rr === 0) rr = 1 / (i + 1);
    }
  }

  const precision = ranked.length > 0 ? tp / ranked.length : 0;
  const recall = expected.size > 0 ? tp / expected.size : 0;
  return { id: c.id, precision, recall, rr, retrieved: ranked };
}

function fmt(n: number): string {
  return n.toFixed(3);
}

function main() {
  const configPath = resolveConfigPath();
  const config = loadConfig(configPath);
  const topK = Number(argValue("--topK") || config.topK || 10);
  const tokens = sampleTokens;

  if (!Array.isArray(config.cases) || config.cases.length === 0) {
    console.error("[eval-search] No benchmark cases found.");
    process.exit(1);
  }

  const results = config.cases.map((c) => evaluateCase(tokens, c, topK));

  const macroPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const macroRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const mrr = results.reduce((sum, r) => sum + r.rr, 0) / results.length;

  console.log(`[eval-search] Dataset: ${config.dataset} v${config.version}`);
  console.log(`[eval-search] Cases: ${results.length} | topK: ${topK}`);
  console.log(`[eval-search] Macro Precision@${topK}: ${fmt(macroPrecision)}`);
  console.log(`[eval-search] Macro Recall@${topK}:    ${fmt(macroRecall)}`);
  console.log(`[eval-search] MRR:                    ${fmt(mrr)}`);

  const failedCases = results.filter((r) => r.recall === 0);
  if (failedCases.length > 0) {
    console.log("[eval-search] Zero-recall cases:");
    for (const failed of failedCases) {
      console.log(`  - ${failed.id}`);
    }
  }

  const pass =
    macroPrecision >= config.thresholds.precisionAtK &&
    macroRecall >= config.thresholds.recallAtK &&
    mrr >= config.thresholds.mrr;

  if (!pass) {
    console.error("[eval-search] FAILED threshold gate.");
    process.exit(1);
  }

  console.log("[eval-search] PASS");
}

main();

