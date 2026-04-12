/**
 * Learning scan runner.
 *
 * Executes the REAL detection helpers from lib/connectors/base.ts against
 * stored project-file content and returns a structured result the API
 * layer can persist. This is not a simulation — the same pure functions
 * the customer-facing connector uses run here.
 *
 * Separation of concerns:
 *   - This file is pure: it takes file content in, returns findings out.
 *     No DB access. No I/O. Easy to unit-test.
 *   - The API route is responsible for loading project files, calling
 *     this runner, and writing the result to learning_scans +
 *     learning_findings.
 *   - Mistake detection (lib/learning/detect-mistakes.ts) runs on the
 *     persisted findings, not the in-memory result.
 */

import {
  extractAIDependenciesFromManifest,
  extractAIEnvVarsFromFile,
  classifyFilePathContext,
  looksLikeAIFrameworkRepo,
  AI_MANIFEST_PATHS,
  ENV_EXAMPLE_PATHS,
} from "@/lib/connectors/base";
import type {
  LearningProjectFile,
  RunnerFinding,
  RunnerResult,
} from "./types";

/**
 * Same code-search patterns the github connector uses. Duplicated here
 * instead of imported so the runner doesn't pull in the connector's
 * Octokit dependency tree (the runner needs to work in any environment).
 */
const AI_FILE_PATTERNS: readonly string[] = [
  "langchain",
  "openai",
  "anthropic",
  "llamaindex",
  "huggingface",
  "amazon-bedrock",
  "google-generativeai",
  "azure-openai",
  "ollama",
  "vllm",
  "vertex-ai",
  "bedrock-runtime",
  "pgvector",
  "CREATE EXTENSION vector",
];

/**
 * Paths we'll never consider worth reporting even if they match a
 * pattern. Mirrors the connector's "noise skip" behavior.
 */
const IGNORE_PATH_FRAGMENTS: readonly string[] = [
  "node_modules",
  "vendor",
  ".lock",
  "package-lock",
  ".min.",
];

function shouldIgnore(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return IGNORE_PATH_FRAGMENTS.some((s) => lower.includes(s));
}

/**
 * Heuristic for confidence on code-search findings. Matches the
 * connector's tier-based floor: tier-1 patterns start high, tier-3+
 * broad patterns start low and climb with corroborating signals.
 * Deliberately stateless — no randomness.
 */
function confidenceForCodeMatch(
  pattern: string,
  filePath: string,
  isFrameworkRepo: boolean,
  isEducational: boolean,
): number {
  if (isFrameworkRepo) return 30;
  if (isEducational) return 35;

  // Tier 1: explicit SDK imports / package names
  const tier1 = new Set([
    "langchain",
    "openai",
    "anthropic",
    "llamaindex",
    "google-generativeai",
    "azure-openai",
    "amazon-bedrock",
  ]);
  // Tier 2: service / runtime names that are less precise
  const tier2 = new Set([
    "ollama",
    "vllm",
    "vertex-ai",
    "bedrock-runtime",
    "huggingface",
  ]);

  let score: number;
  if (tier1.has(pattern)) score = 90;
  else if (tier2.has(pattern)) score = 78;
  else score = 55;

  const ctx = classifyFilePathContext(filePath);
  if (ctx === "user_facing") score = Math.min(100, score + 8);
  if (ctx === "dev_tooling") score = Math.max(30, score - 20);
  return score;
}

function riskForCodeMatch(
  pattern: string,
  filePath: string,
  isFrameworkRepo: boolean,
  isEducational: boolean,
): string {
  if (isFrameworkRepo || isEducational) return "low";
  const ctx = classifyFilePathContext(filePath);
  if (ctx === "dev_tooling" || ctx === "educational") return "low";
  if (ctx === "user_facing") return "high";
  return "medium";
}

/**
 * Main entry point. Runs detection against every stored file and
 * returns a structured result ready to persist.
 */
export function runLearningScan(
  project: {
    label: string;
    source_type: string;
    source_url: string | null;
    metadata: Record<string, unknown>;
  },
  files: Array<Pick<LearningProjectFile, "file_path" | "content">>,
): RunnerResult {
  const findings: RunnerFinding[] = [];

  // Determine framework-repo status once per project using the same
  // helper the connector uses. Uses label + URL as name/full_name input.
  const framework = looksLikeAIFrameworkRepo({
    name: project.label,
    full_name: project.source_url ?? project.label,
    description: (project.metadata?.description as string | undefined) ?? null,
  });

  // Index files by path for fast lookup.
  const byPath = new Map<string, string>();
  for (const f of files) byPath.set(f.file_path, f.content);

  // ---- Manifest pass ----
  for (const manifestPath of AI_MANIFEST_PATHS) {
    const content = byPath.get(manifestPath);
    if (!content) continue;
    if (content.length > 500_000) continue;
    const matches = extractAIDependenciesFromManifest(manifestPath, content);
    for (const match of matches) {
      findings.push({
        source_kind: "manifest",
        file_path: manifestPath,
        pattern_matched: match.provider,
        provider: match.provider,
        path_context: "library_internal",
        is_framework_repo: framework.isFramework,
        is_educational: false,
        confidence: framework.isFramework ? 45 : 90,
        risk_level: framework.isFramework ? "low" : "high",
        raw_metadata: {
          manifestPath,
          frameworkReason: framework.reason,
        },
      });
    }
  }

  // ---- Env var pass ----
  for (const envPath of ENV_EXAMPLE_PATHS) {
    const content = byPath.get(envPath);
    if (!content) continue;
    if (content.length > 200_000) continue;
    const providers = extractAIEnvVarsFromFile(content);
    for (const provider of providers) {
      findings.push({
        source_kind: "env",
        file_path: envPath,
        pattern_matched: provider,
        provider,
        path_context: null,
        is_framework_repo: framework.isFramework,
        is_educational: false,
        confidence: framework.isFramework ? 40 : 88,
        risk_level: framework.isFramework ? "low" : "high",
        raw_metadata: {
          envPath,
          frameworkReason: framework.reason,
        },
      });
    }
  }

  // ---- Code pass ----
  for (const [filePath, content] of byPath) {
    if (shouldIgnore(filePath)) continue;
    if (content.length > 500_000) continue;
    const ctx = classifyFilePathContext(filePath);
    const isEducational = ctx === "educational";
    // Educational paths are skipped entirely (same as the connector).
    if (isEducational) continue;

    for (const pattern of AI_FILE_PATTERNS) {
      if (!content.includes(pattern)) continue;
      findings.push({
        source_kind: "code",
        file_path: filePath,
        pattern_matched: pattern,
        provider: null,
        path_context: ctx,
        is_framework_repo: framework.isFramework,
        is_educational: false,
        confidence: confidenceForCodeMatch(
          pattern,
          filePath,
          framework.isFramework,
          isEducational,
        ),
        risk_level: riskForCodeMatch(
          pattern,
          filePath,
          framework.isFramework,
          isEducational,
        ),
        raw_metadata: {
          pathContext: ctx,
          frameworkRepo: framework.isFramework,
          frameworkReason: framework.reason,
        },
      });
      // One finding per file per pattern — but don't re-scan the same
      // file for the same pattern in this loop (the outer `for` handles
      // that naturally).
    }
  }

  const counts = {
    manifest: findings.filter((f) => f.source_kind === "manifest").length,
    env: findings.filter((f) => f.source_kind === "env").length,
    code: findings.filter((f) => f.source_kind === "code").length,
    total: findings.length,
  };

  return { findings, counts };
}
