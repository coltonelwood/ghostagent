/**
 * Rule-based mistake detector.
 *
 * Runs AFTER a learning scan completes. Evaluates the persisted
 * findings against a set of heuristic rules and flags anything that
 * looks wrong. Never modifies the findings themselves — only writes
 * rows into learning_mistakes for human review.
 *
 * Design principle: each rule is a pure function that takes the full
 * scan result and returns zero or more mistake candidates. Adding a
 * new rule means adding one function; removing a rule is a one-line
 * deletion. The rule set is intentionally small — a bigger rule set
 * just creates noise in the review queue.
 */

import type {
  LearningFinding,
  LearningMistake,
  LearningMistakeType,
  LearningProjectFile,
} from "./types";

type NewMistake = Omit<
  LearningMistake,
  "id" | "created_at" | "reviewed_at" | "reviewed_by" | "resolution_notes"
>;

interface MistakeContext {
  scanId: string;
  projectId: string;
  findings: LearningFinding[];
  files: Array<Pick<LearningProjectFile, "file_path" | "content">>;
  projectLabel: string;
}

type Rule = (ctx: MistakeContext) => NewMistake[];

// --------------------------------------------------------------------------
// Rule 1 — obvious_miss: file content mentions a known AI pattern but
// the scan produced no finding for that file.
// --------------------------------------------------------------------------
const OBVIOUS_AI_STRINGS: Array<{ needle: string; reason: string }> = [
  { needle: "api.openai.com", reason: "raw OpenAI REST endpoint in file" },
  { needle: "api.anthropic.com", reason: "raw Anthropic REST endpoint in file" },
  { needle: "generativelanguage.googleapis.com", reason: "Google Gemini REST endpoint in file" },
  { needle: "api-inference.huggingface.co", reason: "HuggingFace inference API endpoint in file" },
  { needle: "api.cohere.ai", reason: "Cohere REST endpoint in file" },
  { needle: "api.mistral.ai", reason: "Mistral REST endpoint in file" },
];

const ruleObviousMiss: Rule = (ctx) => {
  const mistakes: NewMistake[] = [];
  const flaggedFiles = new Set(ctx.findings.map((f) => f.file_path));

  for (const file of ctx.files) {
    if (flaggedFiles.has(file.file_path)) continue;
    for (const { needle, reason } of OBVIOUS_AI_STRINGS) {
      if (!file.content.includes(needle)) continue;
      mistakes.push({
        scan_id: ctx.scanId,
        project_id: ctx.projectId,
        finding_id: null,
        mistake_type: "obvious_miss" as LearningMistakeType,
        severity: "high",
        description: `File ${file.file_path} contains an obvious AI endpoint (${needle}) but no finding was generated. Reason: ${reason}.`,
        evidence: {
          file_path: file.file_path,
          needle,
          reason,
          snippet: extractSnippet(file.content, needle),
        },
        status: "open",
      });
      break; // one mistake per file is enough
    }
  }

  return mistakes;
};

// --------------------------------------------------------------------------
// Rule 2 — weak_signal: finding was generated but confidence is below
// the display threshold (35) while risk is high or critical. This
// usually means the pattern is correct but the confidence heuristic is
// under-crediting it.
// --------------------------------------------------------------------------
const ruleWeakSignal: Rule = (ctx) => {
  return ctx.findings
    .filter((f) => f.confidence < 35 && (f.risk_level === "high" || f.risk_level === "critical"))
    .map<NewMistake>((f) => ({
      scan_id: ctx.scanId,
      project_id: ctx.projectId,
      finding_id: f.id,
      mistake_type: "weak_signal",
      severity: "medium",
      description: `Finding for ${f.pattern_matched} in ${f.file_path} has confidence ${f.confidence}% but was scored ${f.risk_level}. Confidence will likely cause the UI to drop this finding via the 35% floor.`,
      evidence: {
        pattern: f.pattern_matched,
        file_path: f.file_path,
        confidence: f.confidence,
        risk_level: f.risk_level,
      },
      status: "open",
    }));
};

// --------------------------------------------------------------------------
// Rule 3 — false_positive: high confidence on a dev-tooling or
// educational file. These should always be classified low, not high.
// --------------------------------------------------------------------------
const ruleFalsePositive: Rule = (ctx) => {
  return ctx.findings
    .filter(
      (f) =>
        f.confidence >= 70 &&
        (f.path_context === "dev_tooling" || f.is_educational) &&
        (f.risk_level === "high" || f.risk_level === "critical"),
    )
    .map<NewMistake>((f) => ({
      scan_id: ctx.scanId,
      project_id: ctx.projectId,
      finding_id: f.id,
      mistake_type: "false_positive",
      severity: "high",
      description: `Finding for ${f.pattern_matched} in ${f.file_path} landed ${f.risk_level} at ${f.confidence}% confidence even though it lives in a ${f.path_context ?? "non-operational"} path. This is exactly the kind of false-positive that destroys demo credibility.`,
      evidence: {
        pattern: f.pattern_matched,
        file_path: f.file_path,
        confidence: f.confidence,
        risk_level: f.risk_level,
        path_context: f.path_context,
      },
      status: "open",
    }));
};

// --------------------------------------------------------------------------
// Rule 4 — zero_findings_high_signal: project has a known AI manifest
// file (package.json with openai, etc.) but the scan produced zero
// findings. Usually means the manifest pass broke or the dependency
// pattern regressed.
// --------------------------------------------------------------------------
const ruleZeroFindingsHighSignal: Rule = (ctx) => {
  if (ctx.findings.length > 0) return [];

  const SIGNALS: Array<{ name: string; contains: string; hint: string }> = [
    { name: "package.json", contains: '"openai"', hint: "openai in package.json" },
    { name: "package.json", contains: '"@anthropic-ai/sdk"', hint: "@anthropic-ai/sdk in package.json" },
    { name: "package.json", contains: '"langchain"', hint: "langchain in package.json" },
    { name: "pyproject.toml", contains: "openai", hint: "openai in pyproject.toml" },
    { name: "requirements.txt", contains: "openai", hint: "openai in requirements.txt" },
    { name: ".env.example", contains: "OPENAI_API_KEY", hint: "OPENAI_API_KEY in .env.example" },
  ];

  for (const file of ctx.files) {
    for (const sig of SIGNALS) {
      if (file.file_path.endsWith(sig.name) && file.content.includes(sig.contains)) {
        return [
          {
            scan_id: ctx.scanId,
            project_id: ctx.projectId,
            finding_id: null,
            mistake_type: "zero_findings_high_signal",
            severity: "critical",
            description: `Project "${ctx.projectLabel}" scanned clean but ${sig.hint} was found in ${file.file_path}. Detection is clearly missing something — check the manifest and env-var scanners.`,
            evidence: {
              file_path: file.file_path,
              signal: sig.hint,
              snippet: extractSnippet(file.content, sig.contains),
            },
            status: "open" as const,
          },
        ];
      }
    }
  }
  return [];
};

// --------------------------------------------------------------------------
// Rule 5 — inconsistent_scoring: two code findings for the same tier-1
// pattern in the same path context have different risk levels. This
// indicates non-determinism in the scoring logic.
// --------------------------------------------------------------------------
const ruleInconsistentScoring: Rule = (ctx) => {
  const mistakes: NewMistake[] = [];
  const buckets = new Map<string, LearningFinding[]>();

  for (const f of ctx.findings) {
    if (f.source_kind !== "code") continue;
    const key = `${f.pattern_matched}:${f.path_context ?? "unknown"}`;
    const existing = buckets.get(key) ?? [];
    existing.push(f);
    buckets.set(key, existing);
  }

  for (const [key, group] of buckets) {
    if (group.length < 2) continue;
    const levels = new Set(group.map((g) => g.risk_level));
    if (levels.size > 1) {
      mistakes.push({
        scan_id: ctx.scanId,
        project_id: ctx.projectId,
        finding_id: null,
        mistake_type: "inconsistent_scoring",
        severity: "medium",
        description: `${group.length} findings for pattern "${key}" scored at different risk levels: ${Array.from(levels).join(", ")}. Same pattern in the same context should produce the same risk level.`,
        evidence: {
          pattern_and_context: key,
          finding_ids: group.map((g) => g.id),
          risk_levels: Array.from(levels),
        },
        status: "open",
      });
    }
  }

  return mistakes;
};

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
export function detectMistakes(ctx: MistakeContext): NewMistake[] {
  const rules: Rule[] = [
    ruleObviousMiss,
    ruleWeakSignal,
    ruleFalsePositive,
    ruleZeroFindingsHighSignal,
    ruleInconsistentScoring,
  ];

  const mistakes: NewMistake[] = [];
  for (const rule of rules) {
    try {
      mistakes.push(...rule(ctx));
    } catch {
      // A broken rule should never break the whole detection pass.
      // The caller gets the mistakes the working rules produced.
    }
  }
  return mistakes;
}

function extractSnippet(content: string, needle: string, span = 60): string {
  const idx = content.indexOf(needle);
  if (idx < 0) return "";
  const start = Math.max(0, idx - span);
  const end = Math.min(content.length, idx + needle.length + span);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}
