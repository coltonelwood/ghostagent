/**
 * Improvement proposal engine.
 *
 * Translates a mistake into a concrete proposed change the scanner
 * could make. NEVER writes code or updates patterns automatically —
 * it writes a row into learning_improvements with status="proposed"
 * and waits for a human to mark it "applied" after making the actual
 * pattern-file change.
 *
 * The rationale for human-in-the-loop:
 *   - Auto-applying pattern changes from an automated mistake detector
 *     is how you end up with a runaway regex that flags every file.
 *   - Real improvements require judgment: is this an edge case worth
 *     fixing, or a signal that the underlying heuristic should change?
 *   - The engine can surface the pattern, but an operator decides
 *     whether it belongs in the repo's source of truth.
 */

import type {
  LearningImprovement,
  LearningImprovementType,
  LearningMistake,
} from "./types";

type ProposedImprovement = Omit<
  LearningImprovement,
  "id" | "created_at" | "applied_at" | "applied_by" | "reverted_at"
>;

/**
 * Map a mistake to one or more improvement proposals. Not every mistake
 * yields a proposal — some mistakes need multiple rounds of data to
 * confirm a real pattern.
 */
export function proposeImprovementsForMistake(
  mistake: LearningMistake,
): ProposedImprovement[] {
  switch (mistake.mistake_type) {
    case "obvious_miss":
      return proposeForObviousMiss(mistake);

    case "weak_signal":
      return proposeForWeakSignal(mistake);

    case "false_positive":
      return proposeForFalsePositive(mistake);

    case "zero_findings_high_signal":
      return proposeForZeroFindings(mistake);

    case "inconsistent_scoring":
      return proposeForInconsistency(mistake);

    case "conflicting_classification":
      return [];

    default:
      return [];
  }
}

// --------------------------------------------------------------------------

function proposeForObviousMiss(mistake: LearningMistake): ProposedImprovement[] {
  const needle = String(mistake.evidence?.needle ?? "");
  if (!needle) return [];

  return [
    {
      mistake_id: mistake.id,
      improvement_type: "new_code_pattern" as LearningImprovementType,
      title: `Add code-search pattern for "${needle}"`,
      rationale: `Scan missed a file containing ${needle} — an obvious AI endpoint. Adding this as a code-search pattern should catch the rest of this shape on future scans.`,
      proposed_change: {
        target_file: "lib/connectors/github.ts",
        target_constant: "AI_FILE_PATTERNS",
        add_entry: needle,
      },
      status: "proposed" as const,
    },
  ];
}

function proposeForWeakSignal(mistake: LearningMistake): ProposedImprovement[] {
  const pattern = String(mistake.evidence?.pattern ?? "");
  const confidence = Number(mistake.evidence?.confidence ?? 0);
  if (!pattern) return [];

  return [
    {
      mistake_id: mistake.id,
      improvement_type: "confidence_tuning",
      title: `Tune confidence floor for pattern "${pattern}"`,
      rationale: `Pattern matched but landed at ${confidence}% confidence — below the 35% display threshold. Either raise this pattern's base confidence or remove it from tier-3+ and promote to tier 1/2.`,
      proposed_change: {
        target_file: "lib/connectors/github.ts",
        target_function: "confidenceForCodeMatch (runner) / inline confidence in scanRepo",
        suggestion: `Consider promoting ${pattern} to tier 1 (starts at 90) or increasing floor for tier-3 patterns.`,
      },
      status: "proposed",
    },
  ];
}

function proposeForFalsePositive(mistake: LearningMistake): ProposedImprovement[] {
  const filePath = String(mistake.evidence?.file_path ?? "");
  const pathContext = String(mistake.evidence?.path_context ?? "");
  const proposals: ProposedImprovement[] = [];

  // If the false positive is in a path that isn't already on the
  // exclusion list, propose adding it.
  if (pathContext === "dev_tooling" || pathContext === "educational") {
    proposals.push({
      mistake_id: mistake.id,
      improvement_type: "exclusion_addition",
      title: `Cap confidence lower for ${pathContext} findings`,
      rationale: `Finding at ${filePath} landed high severity despite being in a ${pathContext} path. The existing classifyFilePathContext already categorizes this correctly — the gap is in how downstream scoring applies the classification.`,
      proposed_change: {
        target_file: "lib/connectors/github.ts",
        target_function: "inferEnvFromContext + risk engine",
        suggestion: `Ensure ${pathContext} findings always force environment=development and data_classification=['internal'] so risk engine dampens the score.`,
      },
      status: "proposed",
    });
  }

  return proposals;
}

function proposeForZeroFindings(mistake: LearningMistake): ProposedImprovement[] {
  const signal = String(mistake.evidence?.signal ?? "");
  const file_path = String(mistake.evidence?.file_path ?? "");

  return [
    {
      mistake_id: mistake.id,
      improvement_type: "new_manifest_pattern",
      title: `Regression check: ${signal} should have fired`,
      rationale: `Project scanned clean but ${signal} was present in ${file_path}. Verify the manifest/env-var pattern list covers this case; if it does, the file load path may be broken.`,
      proposed_change: {
        target_file: "lib/connectors/base.ts",
        target_constants: ["AI_DEPENDENCY_PATTERNS", "AI_ENV_VAR_PATTERNS"],
        suggestion: `Check whether the pattern matching ${signal} exists and fires against the ${file_path} content verbatim.`,
      },
      status: "proposed",
    },
  ];
}

function proposeForInconsistency(mistake: LearningMistake): ProposedImprovement[] {
  const key = String(mistake.evidence?.pattern_and_context ?? "");
  return [
    {
      mistake_id: mistake.id,
      improvement_type: "threshold_adjustment",
      title: `Stabilize scoring for "${key}"`,
      rationale: `Multiple findings with the same pattern and path context produced different risk levels. Scoring should be deterministic given identical inputs; this indicates a side-channel in the scoring logic.`,
      proposed_change: {
        target_file: "lib/risk-engine.ts",
        suggestion: `Audit scoreAsset() for any input that differs between otherwise-identical findings — usually environment, owner_status, or ai_services differences that upstream classification missed.`,
      },
      status: "proposed",
    },
  ];
}
