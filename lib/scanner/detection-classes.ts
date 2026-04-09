/**
 * detection-classes.ts
 *
 * All detection patterns organized by class.
 * This is the single source of truth for what the scanner finds.
 *
 * To add a new detection: add a pattern to the relevant class below.
 * The scanner reads this at runtime — no other changes needed.
 *
 * Classes:
 *   1. LLM_INTEGRATION    — direct use of LLM APIs
 *   2. ML_SERVICE         — custom/internal ML inference services
 *   3. ML_MODEL           — Python ML model code (training, serving)
 *   4. CLINICAL_AI        — healthcare-specific AI (NLP, prediction)
 *   5. AI_FEATURE_FLAG    — AI systems behind feature flags
 *   6. DOCUMENT_AI        — OCR, document processing, extraction
 *   7. AUTOMATION_AGENT   — autonomous scripts, cron AI jobs
 *   8. SECURITY_RISK      — auth gaps, secrets, HIPAA misconfig
 *   9. DATA_EXPOSURE      — PHI/PII flowing through AI systems
 *  10. MODEL_INTEGRITY    — ownership, drift, no model cards
 */

export type DetectionClass =
  | "LLM_INTEGRATION"
  | "ML_SERVICE"
  | "ML_MODEL"
  | "CLINICAL_AI"
  | "AI_FEATURE_FLAG"
  | "DOCUMENT_AI"
  | "AUTOMATION_AGENT"
  | "SECURITY_RISK"
  | "DATA_EXPOSURE"
  | "MODEL_INTEGRITY";

export interface DetectionPattern {
  query: string;         // GitHub code search query
  label: string;         // Human-readable label for UI
  class: DetectionClass; // Which detection class this belongs to
  tier: number;          // 1=highest signal, 6=broadest
  riskFloor?: string;    // Minimum risk level if found ("medium"|"high"|"critical")
  phiCritical?: boolean; // If true + phi_context → always CRITICAL
  notes?: string;        // Why this pattern matters
}

export interface ContentSignal {
  name: string;
  pattern: RegExp;
  weight: number; // 0-1, used to boost risk score
  class: DetectionClass;
  notes?: string;
}

export interface ContextualRule {
  name: string;
  condition: (signals: { phi: boolean; isProto: boolean; hasSecrets: boolean; services: string[]; agentType: string; daysSinceCommit: number | null }) => boolean;
  riskFloor: string;
  reason: string;
}

// ─── TIER 1: DIRECT LLM USAGE ────────────────────────────────────────────
export const LLM_PATTERNS: DetectionPattern[] = [
  { query: "openai.chat.completions",   label: "OpenAI Chat",         class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "ChatOpenAI",                label: "LangChain/OpenAI",    class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "langchain",                 label: "LangChain",           class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "AgentExecutor",             label: "LangChain Agent",     class: "LLM_INTEGRATION", tier: 1, riskFloor: "high" },
  { query: "@anthropic-ai/sdk",          label: "Anthropic Claude",    class: "LLM_INTEGRATION", tier: 1, phiCritical: true }, // package import — high precision
  { query: "Anthropic({apiKey",           label: "Anthropic Claude",    class: "LLM_INTEGRATION", tier: 1, phiCritical: true }, // SDK instantiation
  { query: "crewai",                    label: "CrewAI Agent",        class: "LLM_INTEGRATION", tier: 1, riskFloor: "high" },
  { query: "openai.embeddings",         label: "OpenAI Embeddings",   class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "text-embedding-ada",        label: "OpenAI Embeddings",   class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "from openai import",        label: "OpenAI Python SDK",   class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "import anthropic",          label: "Anthropic Python",    class: "LLM_INTEGRATION", tier: 1, phiCritical: true },
  { query: "Groq({apiKey",              label: "Groq LLM",            class: "LLM_INTEGRATION", tier: 2 }, // SDK instantiation only — avoids SQL 'groq' FP
  { query: "mistralai",                 label: "Mistral AI",          class: "LLM_INTEGRATION", tier: 2 },
  { query: "together.ai",               label: "Together AI",         class: "LLM_INTEGRATION", tier: 2 },
  { query: "cohere.generate",           label: "Cohere",              class: "LLM_INTEGRATION", tier: 2 },
  { query: "google.generativeai",       label: "Google Gemini",       class: "LLM_INTEGRATION", tier: 2 },
  { query: "vertexai",                  label: "Google Vertex AI",    class: "LLM_INTEGRATION", tier: 2 },
  { query: "bedrock.invoke_model",      label: "AWS Bedrock",         class: "LLM_INTEGRATION", tier: 2 },
  { query: "AzureOpenAI",               label: "Azure OpenAI",        class: "LLM_INTEGRATION", tier: 2 },
];

// ─── TIER 2: CUSTOM ML SERVICES ───────────────────────────────────────────
export const ML_SERVICE_PATTERNS: DetectionPattern[] = [
  { query: "ML_SCORING_SERVICE_URL",    label: "ML Scoring Service",  class: "ML_SERVICE", tier: 2, riskFloor: "high", notes: "Custom internal ML scoring endpoint" },
  { query: "ML_MODEL_VERSION",          label: "ML Service",          class: "ML_SERVICE", tier: 2, riskFloor: "high" },
  { query: "ML_CONFIDENCE_THRESHOLD",   label: "ML Service",          class: "ML_SERVICE", tier: 2, riskFloor: "high" },
  { query: "inference_endpoint",        label: "ML Inference",        class: "ML_SERVICE", tier: 2, riskFloor: "high" },
  // 'scoring_service' removed — too generic, matches non-AI code
  { query: "model_serving",             label: "ML Serving",          class: "ML_SERVICE", tier: 2, riskFloor: "high" },
  { query: "triton_client",             label: "NVIDIA Triton",       class: "ML_SERVICE", tier: 2, riskFloor: "high" },
  { query: "seldon",                    label: "Seldon ML",           class: "ML_SERVICE", tier: 2 },
  { query: "bentoml",                   label: "BentoML",             class: "ML_SERVICE", tier: 2 },
  { query: "ray.serve",                 label: "Ray Serve",           class: "ML_SERVICE", tier: 2 },
  { query: "torchserve",                label: "TorchServe",          class: "ML_SERVICE", tier: 2 },
];

// ─── TIER 3: PYTHON ML MODELS ─────────────────────────────────────────────
export const ML_MODEL_PATTERNS: DetectionPattern[] = [
  { query: "transformers torch",        label: "HuggingFace Model",   class: "ML_MODEL", tier: 3, riskFloor: "high" },
  { query: "torch.load(",               label: "PyTorch Model",       class: "ML_MODEL", tier: 3 }, // paren reduces FP vs docs
  { query: ".predict(X",                label: "ML Model",            class: "ML_MODEL", tier: 3 }, // sklearn-style call — more specific
  { query: "mlflow",                    label: "MLflow Tracking",     class: "ML_MODEL", tier: 3 },
  { query: "SentenceTransformer",       label: "Sentence Embeddings", class: "ML_MODEL", tier: 3, phiCritical: true },
  { query: "sklearn.pipeline.Pipeline", label: "Scikit-learn Pipeline",class: "ML_MODEL", tier: 4 }, // full import path, not a word
  { query: "xgboost",                   label: "XGBoost Model",       class: "ML_MODEL", tier: 4 },
  { query: "lightgbm",                  label: "LightGBM Model",      class: "ML_MODEL", tier: 4 },
  { query: "wandb",                     label: "Weights & Biases",    class: "MODEL_INTEGRITY", tier: 4 },
  { query: "neptune.init",              label: "Neptune ML Tracking", class: "MODEL_INTEGRITY", tier: 4 },
];

// ─── TIER 4: CLINICAL / HEALTHCARE AI ────────────────────────────────────
export const CLINICAL_AI_PATTERNS: DetectionPattern[] = [
  { query: "Bio_ClinicalBERT",          label: "Clinical BERT",       class: "CLINICAL_AI", tier: 1, riskFloor: "critical", phiCritical: true, notes: "Fine-tuned on clinical notes — always PHI risk" },
  { query: "readmission",               label: "Readmission Model",   class: "CLINICAL_AI", tier: 2, riskFloor: "high",     phiCritical: true },
  { query: "patient_similarity",        label: "Patient Similarity",  class: "CLINICAL_AI", tier: 2, riskFloor: "high",     phiCritical: true },
  { query: "clinical_bert",             label: "Clinical BERT",       class: "CLINICAL_AI", tier: 2, riskFloor: "high",     phiCritical: true },
  { query: "diagnosis_prediction",      label: "Diagnosis AI",        class: "CLINICAL_AI", tier: 2, riskFloor: "critical", phiCritical: true },
  { query: "icd10 prediction",          label: "ICD-10 Coding AI",    class: "CLINICAL_AI", tier: 2, riskFloor: "high",     phiCritical: true },
  { query: "cpt_suggestion",            label: "CPT Suggestion AI",   class: "CLINICAL_AI", tier: 2, riskFloor: "high",     phiCritical: true },
  { query: "medical_nlp",               label: "Medical NLP",         class: "CLINICAL_AI", tier: 3, riskFloor: "high",     phiCritical: true },
  { query: "clinical_notes_embedding",  label: "Clinical Notes AI",   class: "CLINICAL_AI", tier: 3, riskFloor: "high", phiCritical: true }, // 'clinical_notes' alone too generic
  { query: "ehr_extraction",            label: "EHR Extraction AI",   class: "CLINICAL_AI", tier: 3, riskFloor: "high",     phiCritical: true },
  { query: "nlu_triage",                label: "NLU Triage Model",    class: "CLINICAL_AI", tier: 2, riskFloor: "critical", phiCritical: true },
];

// ─── TIER 5: AI FEATURE FLAGS ─────────────────────────────────────────────
export const FEATURE_FLAG_PATTERNS: DetectionPattern[] = [
  { query: "FF_AI_",                    label: "AI Feature Flag",     class: "AI_FEATURE_FLAG", tier: 3 },
  { query: "enable_ai",                 label: "AI Feature Flag",     class: "AI_FEATURE_FLAG", tier: 3 },
  { query: "ai_enabled",                label: "AI Feature Flag",     class: "AI_FEATURE_FLAG", tier: 3 },
  { query: "ai_review",                 label: "AI Feature Flag",     class: "AI_FEATURE_FLAG", tier: 3 },
  { query: "ai-coding-suggestions",     label: "AI Coding Assist",    class: "AI_FEATURE_FLAG", tier: 3, riskFloor: "high", notes: "AI suggesting billing codes — fraud risk if wrong" },
  { query: "ai_claim_review",           label: "AI Claims Review",    class: "AI_FEATURE_FLAG", tier: 3, riskFloor: "high" },
  { query: "enable_ai_suggestions",     label: "AI Suggestions",      class: "AI_FEATURE_FLAG", tier: 3 },
  { query: "use_ai_triage",             label: "AI Triage Flag",      class: "AI_FEATURE_FLAG", tier: 3, riskFloor: "high" },
  { query: "ai_auto_approve",           label: "AI Auto-Approve",     class: "AI_FEATURE_FLAG", tier: 2, riskFloor: "critical", notes: "AI making autonomous approval decisions — highest risk" },
];

// ─── TIER 6: DOCUMENT AI / OCR ───────────────────────────────────────────
export const DOCUMENT_AI_PATTERNS: DetectionPattern[] = [
  { query: "textract",                  label: "AWS Textract",        class: "DOCUMENT_AI", tier: 3, phiCritical: true },
  { query: "ocr_process",               label: "OCR Processing",      class: "DOCUMENT_AI", tier: 3 },
  { query: "document_intelligence",     label: "Azure Doc AI",        class: "DOCUMENT_AI", tier: 3, phiCritical: true },
  { query: "vision_api",                label: "Vision API",          class: "DOCUMENT_AI", tier: 3 },
  { query: "pdfplumber",                label: "PDF AI Extraction",   class: "DOCUMENT_AI", tier: 4 },
  { query: "unstructured.partition",    label: "Unstructured IO",     class: "DOCUMENT_AI", tier: 4 },
  { query: "llmsherpa",                 label: "LLM PDF Parser",      class: "DOCUMENT_AI", tier: 3 },
  { query: "docling",                   label: "Document LLM",        class: "DOCUMENT_AI", tier: 3 },
];

// ─── TIER 7: AUTOMATION AGENTS / CRON AI ─────────────────────────────────
export const AUTOMATION_PATTERNS: DetectionPattern[] = [
  { query: "run-anomaly-detection",     label: "Anomaly Detection",   class: "AUTOMATION_AGENT", tier: 3, riskFloor: "high" }, // file/script name pattern
  { query: "AnomalyDetector",            label: "Anomaly Detection",   class: "AUTOMATION_AGENT", tier: 3, riskFloor: "high" }, // class name pattern
  { query: "ANOMALY_THRESHOLD",         label: "Anomaly Detection",   class: "AUTOMATION_AGENT", tier: 3, riskFloor: "high" },
  { query: "fraud_model",               label: "Fraud Detection",     class: "AUTOMATION_AGENT", tier: 2, riskFloor: "high" },
  { query: "claims-fraud",              label: "Claims Fraud AI",     class: "AUTOMATION_AGENT", tier: 2, riskFloor: "high" },
  { query: "auto_remediate",            label: "Auto-Remediation",    class: "AUTOMATION_AGENT", tier: 2, riskFloor: "critical", notes: "Autonomous remediation without human approval" },
  { query: "ai_decision",               label: "AI Decision Engine",  class: "AUTOMATION_AGENT", tier: 2, riskFloor: "high" },
  { query: "autonomous_agent",          label: "Autonomous Agent",    class: "AUTOMATION_AGENT", tier: 1, riskFloor: "critical" },
  { query: "self_healing",              label: "Self-Healing System", class: "AUTOMATION_AGENT", tier: 2, riskFloor: "high" },
];

// ─── COMBINED EXPORT ──────────────────────────────────────────────────────
export const ALL_PATTERNS: DetectionPattern[] = [
  ...LLM_PATTERNS,
  ...ML_SERVICE_PATTERNS,
  ...ML_MODEL_PATTERNS,
  ...CLINICAL_AI_PATTERNS,
  ...FEATURE_FLAG_PATTERNS,
  ...DOCUMENT_AI_PATTERNS,
  ...AUTOMATION_PATTERNS,
];

// ─── CONTENT SIGNALS (inline analysis, not search queries) ───────────────
// These run against file content after a file is fetched
export const CONTENT_SIGNALS: ContentSignal[] = [
  // PHI signals
  { name: "phi_hipaa",        pattern: /HIPAA|hipaa_audit|HIPAA_AUDIT/i,             weight: 0.9, class: "DATA_EXPOSURE" },
  { name: "phi_fhir",         pattern: /hl7|fhir|FHIR|epic_client|cerner/i,          weight: 0.8, class: "DATA_EXPOSURE" },
  { name: "phi_mrn",          pattern: /mrn|medical.record.number|patient_id/i,      weight: 0.7, class: "DATA_EXPOSURE" },
  { name: "phi_pii",          pattern: /ssn|social.security|date.of.birth|dob[^\w]/i,weight: 0.8, class: "DATA_EXPOSURE" },
  // Security risks
  { name: "no_auth",          pattern: /trust.*client.*id|no.*auth|TODO.*auth/i,     weight: 0.9, class: "SECURITY_RISK" },
  { name: "no_audit",         pattern: /TODO.*audit|no.*audit.*log|missing.*HIPAA/i, weight: 0.9, class: "SECURITY_RISK" },
  { name: "in_memory_only",   pattern: /in.memory|in-memory|messages.*memory|no.*persist/i, weight: 0.7, class: "SECURITY_RISK" },
  { name: "plain_credentials",pattern: /password.*=.*['"]\w{4,}['"]|secret.*=.*['"]\w{8,}['"]/i, weight: 1.0, class: "SECURITY_RISK" },
  // Model integrity
  { name: "no_owner",         pattern: /owner.*unknown|no.*owner|TODO.*owner|ask.*@\w+/i, weight: 0.6, class: "MODEL_INTEGRITY" },
  { name: "stale_todo",       pattern: /TODO.*PHI|TODO.*HIPAA|TODO.*security|FIXME.*auth/i, weight: 0.8, class: "SECURITY_RISK" },
  { name: "deprecated_live",  pattern: /DEPRECATED.*running|still.*running.*deprecated/i, weight: 0.7, class: "MODEL_INTEGRITY" },
  // Patient safety
  { name: "auto_decision",    pattern: /auto.*submit|auto.*approve|auto.*prescri|autonomous.*decision/i, weight: 0.9, class: "AUTOMATION_AGENT" },
  { name: "no_human_review",  pattern: /no.*human.*review|without.*human|bypass.*review/i, weight: 0.8, class: "AUTOMATION_AGENT" },
];

// ─── CONTEXTUAL RISK RULES (multi-signal combinations) ───────────────────
export const CONTEXTUAL_RULES: ContextualRule[] = [
  {
    name: "llm_phi_critical",
    condition: ({ phi, agentType }) =>
      phi && ["OpenAI", "LangChain/OpenAI", "Anthropic Claude", "OpenAI Python SDK",
              "OpenAI Embeddings", "Clinical BERT", "NLU Triage Model"].includes(agentType),
    riskFloor: "critical",
    reason: "LLM integration detected in a HIPAA/PHI environment — review whether patient data may be transmitted to a third-party AI provider and whether a Business Associate Agreement is in place.",
  },
  {
    name: "clinical_ai_always_high",
    condition: ({ agentType }) =>
      ["Clinical BERT", "Readmission Model", "Patient Similarity", "Diagnosis AI",
       "ICD-10 Coding AI", "CPT Suggestion AI", "NLU Triage Model"].includes(agentType),
    riskFloor: "high",
    reason: "Clinical AI system operating on patient data — requires model card, accuracy documentation, and named owner.",
  },
  {
    name: "prototype_no_auth",
    condition: ({ isProto }) => isProto,
    riskFloor: "high",
    reason: "Prototype/experiment code in production repository — no governance, no documented owner, may have been tested with real patient data.",
  },
  {
    name: "orphaned_long_term",
    condition: ({ daysSinceCommit }) => daysSinceCommit !== null && daysSinceCommit > 180,
    riskFloor: "critical",
    reason: "No commits in 6+ months — original owner likely departed. System running with no accountable owner.",
  },
  {
    name: "orphaned_medium_term",
    condition: ({ daysSinceCommit }) => daysSinceCommit !== null && daysSinceCommit > 90,
    riskFloor: "high",
    reason: "No commits in 90+ days — ownership uncertain. Requires verification of active maintainer.",
  },
  {
    name: "ml_service_no_doc",
    condition: ({ agentType }) => agentType === "ML Scoring Service" || agentType === "ML Service",
    riskFloor: "high",
    reason: "Custom ML service detected — verify model accuracy, bias testing, and data access scope are documented.",
  },
  {
    name: "auto_approval_critical",
    condition: ({ agentType }) => agentType === "AI Auto-Approve",
    riskFloor: "critical",
    reason: "AI system making autonomous approvals without human review — highest governance risk.",
  },
  {
    name: "many_services",
    condition: ({ services }) => services.length >= 4,
    riskFloor: "high",
    reason: `AI system integrated with multiple external services — broad blast radius if compromised or misbehaves.`,
  },
];

// ─── PHI ENVIRONMENT SIGNALS (repo-level) ────────────────────────────────
export const PHI_ENV_SIGNALS: RegExp[] = [
  /HIPAA/i,
  /hipaa_audit/i,
  /phi_/i,
  /hl7|fhir/i,
  /epic_client|cerner_client|athena_client/i,
  /ENCRYPTION_AT_REST/i,
  /mrn|medical.record/i,
  /patient_mrn|patient_id.*phi/i,
  /\bPHI\b/,
];

// ─── PROTOTYPE PATH SIGNALS ───────────────────────────────────────────────
export const PROTOTYPE_PATH_SIGNALS: RegExp[] = [
  /^experiments\//i,
  /^prototype/i,
  /\/proto\//i,
  /\/spike\//i,
  /\/poc\//i,
  /-prototype/i,
  /-experimental/i,
];

// Experiment paths that are NOT AI risk (exclude from prototype flag)
export const NON_AI_EXPERIMENT_EXCLUSIONS: RegExp[] = [
  /\/ab-tests\//i,
  /\/perf-benchmarks\//i,
  /\/load-test/i,
  /\/benchmark/i,
];

// ─── FLAG FILE PATHS TO SCAN ──────────────────────────────────────────────
export const FLAG_FILE_PATHS = [
  "experiments/feature-flags/flag-config.json",
  "config/feature-flags/flags.json",
  "config/feature-flags/overrides.json",
  "feature-flags.json",
  "flags.json",
  ".launchdarkly/flags.json",
];

// AI flag name patterns (regex applied to flag names in JSON)
export const AI_FLAG_NAME_PATTERN = /\b(ai|ml|llm|model|predict|suggest|automat|gpt|claude|embed)\b/i;
