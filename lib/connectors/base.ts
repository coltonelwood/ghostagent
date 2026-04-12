import type {
  Connector,
  ConnectorKind,
  ConnectorCategory,
  ConnectorDefinition,
  NormalizedAsset,
  SyncResult,
  HRSyncResult,
} from "../types/platform";

// ============================================================
// Nexus Connector Framework — Base Interface
// ============================================================

export interface NexusConnector {
  kind: ConnectorKind;
  displayName: string;
  description: string;
  category: ConnectorCategory;
  icon: string; // lucide icon name

  /**
   * Validate credentials without saving them.
   * Returns { valid: true } or { valid: false, error: string }
   */
  validate(credentials: Record<string, string>): Promise<{ valid: boolean; error?: string }>;

  /**
   * Perform a full sync. Returns normalized assets and any errors.
   */
  sync(connector: Connector, credentials: Record<string, string>): Promise<SyncResult>;

  /**
   * Quarantine an asset (e.g., disable a function, deactivate a Zap).
   * Optional — not all connectors support this.
   */
  quarantine?(
    connector: Connector,
    credentials: Record<string, string>,
    externalId: string
  ): Promise<{ success: boolean; error?: string }>;
}

export interface NexusHRConnector extends NexusConnector {
  category: "hr";
  /**
   * Fetch the active employee list for ownership cross-reference.
   */
  fetchEmployees(credentials: Record<string, string>): Promise<HRSyncResult>;
}

export function isHRConnector(connector: NexusConnector): connector is NexusHRConnector {
  return connector.category === "hr";
}

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    kind: "github",
    displayName: "GitHub",
    description: "Scan GitHub repositories for AI agent code, workflows, and dependencies",
    category: "code",
    icon: "github",
    authType: "token",
    fields: [
      {
        key: "token",
        label: "Personal Access Token",
        type: "password",
        required: true,
        placeholder: "ghp_...",
        description: "Requires repo read scope. For GitHub App, use the installation token.",
      },
      {
        key: "org",
        label: "GitHub Organization",
        type: "text",
        required: true,
        placeholder: "my-company",
        description: "Your GitHub organization name (not URL).",
      },
    ],
  },
  {
    kind: "gitlab",
    displayName: "GitLab",
    description: "Scan GitLab projects for AI-related code and pipelines",
    category: "code",
    icon: "gitlab",
    authType: "token",
    fields: [
      {
        key: "token",
        label: "Personal Access Token",
        type: "password",
        required: true,
        placeholder: "glpat-...",
        description: "Requires api and read_repository scopes.",
      },
      {
        key: "baseUrl",
        label: "GitLab URL",
        type: "url",
        required: false,
        placeholder: "https://gitlab.com",
        description: "Leave blank for gitlab.com. Set for self-hosted.",
      },
    ],
  },
  {
    kind: "bitbucket",
    displayName: "Bitbucket",
    description: "Scan Bitbucket repositories for AI agent code",
    category: "code",
    icon: "git-branch",
    authType: "key+secret",
    fields: [
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        placeholder: "your-bitbucket-username",
      },
      {
        key: "appPassword",
        label: "App Password",
        type: "password",
        required: true,
        placeholder: "ATBB...",
        description: "Create an App Password with Repositories: Read scope.",
      },
      {
        key: "workspace",
        label: "Workspace",
        type: "text",
        required: true,
        placeholder: "my-workspace",
      },
    ],
  },
  {
    kind: "aws",
    displayName: "AWS",
    description: "Discover AI systems in Lambda functions, API Gateway, and Bedrock usage",
    category: "cloud",
    icon: "cloud",
    authType: "key+secret",
    fields: [
      {
        key: "accessKeyId",
        label: "Access Key ID",
        type: "text",
        required: true,
        placeholder: "AKIAIOSFODNN7EXAMPLE",
      },
      {
        key: "secretAccessKey",
        label: "Secret Access Key",
        type: "password",
        required: true,
        placeholder: "wJalrXUtnFEMI/...",
      },
      {
        key: "region",
        label: "AWS Region",
        type: "text",
        required: true,
        placeholder: "us-east-1",
      },
    ],
  },
  {
    kind: "gcp",
    displayName: "Google Cloud",
    description: "Discover AI systems in Cloud Functions, Vertex AI, and Cloud Run",
    category: "cloud",
    icon: "cloud",
    authType: "json",
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "textarea",
        required: true,
        placeholder: '{"type":"service_account",...}',
        description: "Service account key with roles/cloudfunctions.viewer and roles/logging.viewer",
      },
      {
        key: "projectId",
        label: "GCP Project ID",
        type: "text",
        required: true,
        placeholder: "my-project-123",
      },
    ],
  },
  {
    kind: "azure",
    displayName: "Azure",
    description: "Discover AI systems in Azure Functions, Azure OpenAI, and Logic Apps",
    category: "cloud",
    icon: "cloud",
    authType: "key+secret",
    fields: [
      {
        key: "tenantId",
        label: "Tenant ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientId",
        label: "Client ID (App ID)",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        required: true,
      },
      {
        key: "subscriptionId",
        label: "Subscription ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
    ],
  },
  {
    kind: "zapier",
    displayName: "Zapier",
    description: "Discover AI-powered Zaps across your Zapier account",
    category: "automation",
    icon: "zap",
    authType: "token",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "zapier_api_key_...",
        description: "Found in Zapier Settings > Developer > API Key",
      },
    ],
  },
  {
    kind: "n8n",
    displayName: "n8n",
    description: "Discover AI workflows in your n8n instance",
    category: "automation",
    icon: "workflow",
    authType: "url+key",
    fields: [
      {
        key: "instanceUrl",
        label: "n8n Instance URL",
        type: "url",
        required: true,
        placeholder: "https://your-n8n.example.com",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        description: "Generate in n8n Settings > API > Create API Key",
      },
    ],
  },
  {
    kind: "make",
    displayName: "Make",
    description: "Discover AI scenarios in your Make (formerly Integromat) account",
    category: "automation",
    icon: "workflow",
    authType: "token",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        description: "Found in Make Profile > API key",
      },
      {
        key: "teamId",
        label: "Team ID",
        type: "text",
        required: true,
        placeholder: "12345",
        description: "Your Make team ID from Settings > Team",
      },
    ],
    configFields: [
      {
        key: "zone",
        label: "Zone",
        type: "text",
        required: false,
        placeholder: "us1",
        description:
          "Make region — us1, us2, eu1, or eu2. Leave blank for us1.",
      },
    ],
  },
  {
    kind: "rippling",
    displayName: "Rippling",
    description: "Sync employee data for ownership verification and offboarding detection",
    category: "hr",
    icon: "users",
    authType: "token",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        description: "Found in Rippling Developer Settings",
      },
    ],
  },
  {
    kind: "bamboohr",
    displayName: "BambooHR",
    description: "Sync employee data for ownership verification and offboarding detection",
    category: "hr",
    icon: "users",
    authType: "url+key",
    fields: [
      {
        key: "subdomain",
        label: "BambooHR Subdomain",
        type: "text",
        required: true,
        placeholder: "yourcompany",
        description: "The subdomain in yourcompany.bamboohr.com",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        description: "Generate in BambooHR: My Account > API Keys",
      },
    ],
  },
  {
    kind: "workday",
    displayName: "Workday",
    description: "Sync employee data for ownership verification and offboarding detection",
    category: "hr",
    icon: "users",
    authType: "key+secret",
    fields: [
      {
        key: "tenantUrl",
        label: "Tenant URL",
        type: "url",
        required: true,
        placeholder: "https://wd2-impl-services1.workday.com/ccx/api/v1/yourcompany",
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        required: true,
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        required: true,
      },
    ],
  },
  {
    kind: "sdk",
    displayName: "Internal SDK",
    description: "Self-report AI systems from your own codebase using the Nexus SDK",
    category: "internal",
    icon: "code",
    authType: "token",
    fields: [],
    configFields: [
      {
        key: "description",
        label: "Description",
        type: "text",
        required: false,
        placeholder: "Our internal AI systems",
      },
    ],
  },
];

export function getConnectorDefinition(kind: ConnectorKind): ConnectorDefinition | undefined {
  return CONNECTOR_DEFINITIONS.find((d) => d.kind === kind);
}

// ---- Shared helpers ----

const AI_PATTERNS = [
  { pattern: /openai|gpt-[34]|gpt4|chatgpt/i, provider: "openai" },
  { pattern: /anthropic|claude/i, provider: "anthropic" },
  { pattern: /langchain/i, provider: "langchain" },
  { pattern: /llamaindex|llama.?index/i, provider: "llamaindex" },
  { pattern: /huggingface|transformers/i, provider: "huggingface" },
  { pattern: /bedrock|amazon.*ai|sagemaker/i, provider: "aws" },
  { pattern: /vertex.?ai|google.?ai|palm|gemini/i, provider: "google" },
  { pattern: /azure.?openai|cognitive.?services/i, provider: "azure" },
  { pattern: /cohere/i, provider: "cohere" },
  { pattern: /groq/i, provider: "groq" },
  { pattern: /together.?ai/i, provider: "together-ai" },
  { pattern: /mistral/i, provider: "mistral" },
  { pattern: /ai\.?sdk|vercel.?ai/i, provider: "vercel-ai" },
];

export function detectAIServices(text: string): Array<{ provider: string }> {
  const found = new Set<string>();
  for (const { pattern, provider } of AI_PATTERNS) {
    if (pattern.test(text)) found.add(provider);
  }
  return Array.from(found).map((p) => ({ provider: p }));
}

export function isAIRelated(text: string): boolean {
  return AI_PATTERNS.some(({ pattern }) => pattern.test(text));
}

// ==========================================================================
// File-path context classifier
// ==========================================================================
//
// Where a file lives in a repo tells you more about its risk than what it
// imports. A file at `apps/web/api/chat/route.ts` that calls OpenAI is a
// production customer-facing feature. A file at `.cursor/rules.md` with
// the same OpenAI match is developer tooling. A file at `examples/rag.py`
// is documentation.
//
// The classifier is intentionally conservative — unrecognized paths stay
// `unknown` so the rest of the pipeline treats them normally.
// ==========================================================================

export type FilePathContext =
  | "user_facing"    // API routes, page handlers, pages/app — likely production
  | "dev_tooling"    // AI coding assistant rules/prompts — not a product feature
  | "educational"    // examples/cookbook/docs/tutorials — not operational
  | "library_internal" // internal lib/utils/helpers — hard to judge, treated as unknown env
  | "unknown";

// User-facing surfaces — common conventions across Next.js, Remix, Fresh,
// Rails, Django, Laravel, Express, etc. Matches anywhere in the path.
const USER_FACING_PATH_SIGNALS: RegExp[] = [
  /(^|\/)(apps?|packages|services)\/[^/]+\/(api|server|routes?|handlers?|controllers?|endpoints?)\//i,
  /(^|\/)(app|pages|src)\/api\//i,
  /(^|\/)pages\/api\//i,
  /(^|\/)src\/routes\//i,
  /(^|\/)server\/(api|routes?|handlers?)\//i,
  /(^|\/)functions\//i, // firebase functions, cloudflare workers
  /(^|\/)worker\//i,
  /(^|\/)edge\//i,
  /(^|\/)api\/[^/]+\/route\.(ts|js|tsx|jsx|py|rb)$/i,
];

// Developer-tooling paths — AI coding assistants, internal prompt libraries.
// These are NOT customer-facing and should not be treated as operational AI.
const DEV_TOOLING_PATH_SIGNALS: RegExp[] = [
  /(^|\/)\.cursor\//i,
  /(^|\/)\.cursorrules$/i,
  /(^|\/)\.claude\//i,
  /(^|\/)\.aider\//i,
  /(^|\/)\.continue\//i,
  /(^|\/)\.codeium\//i,
  /(^|\/)\.github\/copilot/i,
  /(^|\/)agents\/(rules|skills|commands)/i,
  /(^|\/)\.ai\//i,
  /(^|\/)\.vscode\/copilot/i,
  /(^|\/)prompts\//i,
];

// Educational / documentation paths. Mirrors the scanner's
// EDUCATIONAL_PATH_SIGNALS but kept local so the connector doesn't have
// to import from lib/scanner (different subsystem).
const EDUCATIONAL_PATH_SIGNALS_CONNECTOR: RegExp[] = [
  /^docs?\//i,
  /\/docs?\//i,
  /^examples?\//i,
  /\/examples?\//i,
  /^cookbook\//i,
  /\/cookbook\//i,
  /^tutorials?\//i,
  /\/tutorials?\//i,
  /^demos?\//i,
  /\/demos?\//i,
  /^samples?\//i,
  /\/samples?\//i,
  /^quickstart\//i,
  /\/quickstart\//i,
  /\.ipynb$/i,
  /README(\.\w+)?$/,
];

const LIBRARY_INTERNAL_PATH_SIGNALS: RegExp[] = [
  /(^|\/)(lib|libs|utils?|helpers?|shared|common|core|internal)\//i,
  /(^|\/)src\/(lib|libs|utils?|helpers?|shared|common|core)\//i,
];

/**
 * Classify a file path into a "context" that tells downstream risk
 * logic what kind of location this finding lives in. Ordering matters:
 * we check dev_tooling and educational FIRST so a file like
 * `.cursor/rules/api.md` isn't mistaken for a user_facing API route.
 */
export function classifyFilePathContext(filePath: string): FilePathContext {
  if (DEV_TOOLING_PATH_SIGNALS.some((p) => p.test(filePath))) return "dev_tooling";
  if (EDUCATIONAL_PATH_SIGNALS_CONNECTOR.some((p) => p.test(filePath))) return "educational";
  if (USER_FACING_PATH_SIGNALS.some((p) => p.test(filePath))) return "user_facing";
  if (LIBRARY_INTERNAL_PATH_SIGNALS.some((p) => p.test(filePath))) return "library_internal";
  return "unknown";
}

// ==========================================================================
// Hidden AI detection — dependency manifests + env vars
// ==========================================================================
//
// Code search (the connector's default path) only matches files that
// import an AI library directly. That misses the most common way real
// companies ship AI:
//
//   1. A shared wrapper module (`services/ai.ts`) calls OpenAI. Every
//      consumer in the app calls `summarize(text)` instead of
//      `openai.chat.completions`, so code search only returns one file.
//   2. The AI library is declared in `package.json` / `pyproject.toml`
//      but not imported anywhere in the search path (e.g. it's loaded
//      in a background worker outside the main tree).
//   3. The API key is committed to `.env.example` with a comment like
//      `# Required for the AI summarization feature` — a human knows
//      this is AI, code search does not.
//
// The patterns below are matched against raw manifest/env-file text so
// we catch these cases without needing a full parser. Matches are
// conservative — "openai" alone won't match a random word, only the
// known package-name shapes and env-var shapes.
// ==========================================================================

/**
 * Package / dependency names that mean "this project uses AI".
 * Matched against raw manifest text (package.json, pyproject.toml,
 * requirements.txt, Gemfile, composer.json, go.mod, etc.) so we catch
 * declarations without needing a full parser per ecosystem.
 *
 * The regex requires a word boundary before the match so a random
 * comment containing "openai" doesn't false-positive.
 */
export interface AIDependency {
  provider: string;
  pattern: RegExp;
}

export const AI_DEPENDENCY_PATTERNS: AIDependency[] = [
  // OpenAI ecosystem
  { provider: "openai", pattern: /["'`]\s*openai\b/i },
  { provider: "openai", pattern: /["'`]@azure\/openai["'`]/i },
  { provider: "openai", pattern: /openai-php\/client/i },
  { provider: "openai", pattern: /ruby-openai/i },
  { provider: "openai", pattern: /go-openai/i },
  { provider: "openai", pattern: /openai\.api_key/i },
  // Rust async-openai crate
  { provider: "openai", pattern: /\basync-openai\s*=/i },
  // JVM: official openai-java or community Kotlin clients
  { provider: "openai", pattern: /["'`]com\.openai:openai-java["'`]/i },
  { provider: "openai", pattern: /openai-kotlin/i },
  // Elixir mix dep
  { provider: "openai", pattern: /:openai,\s*"~>/i },
  { provider: "openai", pattern: /:ex_openai,\s*"~>/i },

  // Anthropic
  { provider: "anthropic", pattern: /["'`]@anthropic-ai\/sdk["'`]/i },
  { provider: "anthropic", pattern: /["'`]anthropic["'`]/i },
  { provider: "anthropic", pattern: /anthropic-sdk-\w+/i },
  // Rust
  { provider: "anthropic", pattern: /\banthropic-sdk\s*=/i },
  // JVM
  { provider: "anthropic", pattern: /com\.anthropic:anthropic/i },

  // LangChain family
  { provider: "langchain", pattern: /["'`]langchain["'`]/i },
  { provider: "langchain", pattern: /["'`]@langchain\/\w+/i },
  { provider: "langchain", pattern: /langchaingo/i },
  { provider: "langchain", pattern: /langchainrb/i },
  // JVM: langchain4j
  { provider: "langchain", pattern: /dev\.langchain4j:langchain4j/i },
  { provider: "langchain", pattern: /langchain4j-core/i },

  // Other LLM / ML SDKs
  { provider: "llamaindex", pattern: /["'`](llama[-_]?index|@llamaindex\/\w+)["'`]/i },
  { provider: "huggingface", pattern: /["'`](@huggingface\/\w+|huggingface[-_]hub|transformers)["'`]/i },
  { provider: "google", pattern: /["'`](@google\/generative-ai|google-generativeai|@google\/genai)["'`]/i },
  { provider: "cohere", pattern: /["'`]cohere(-ai)?["'`]/i },
  { provider: "replicate", pattern: /["'`]replicate["'`]/i },
  { provider: "groq", pattern: /["'`]groq(-sdk)?["'`]/i },
  { provider: "together-ai", pattern: /["'`]together(-ai)?["'`]/i },
  { provider: "mistral", pattern: /["'`]@?mistralai?(\/\w+)?["'`]/i },

  // Meta-SDKs and orchestration
  { provider: "vercel-ai", pattern: /["'`]ai["'`]\s*:\s*["']\^?\d/i }, // Vercel AI SDK shows as "ai": "^x.y.z" in package.json
  { provider: "litellm", pattern: /["'`]litellm["'`]/i },
  { provider: "instructor", pattern: /["'`]instructor["'`]/i },
  { provider: "dspy", pattern: /["'`]dspy(-ai)?["'`]/i },
  { provider: "haystack", pattern: /["'`](haystack|farm-haystack)["'`]/i },
  { provider: "vllm", pattern: /["'`]vllm["'`]/i },

  // Framework-adjacent inference
  { provider: "ollama", pattern: /["'`]ollama["'`]/i },
  { provider: "openrouter", pattern: /["'`]openrouter["'`]/i },

  // Dockerfile FROM clauses pulling AI-specific base images. These
  // match raw Dockerfile lines, not quoted package names, so the
  // pattern starts with a word boundary.
  { provider: "ollama", pattern: /^FROM\s+ollama\//im },
  { provider: "huggingface", pattern: /^FROM\s+huggingface\//im },
  { provider: "vllm", pattern: /^FROM\s+vllm\//im },
  { provider: "nvidia-inference", pattern: /^FROM\s+nvcr\.io\/nvidia\/(tritonserver|tensorrt-llm)/im },

  // Terraform resources — cloud LLM endpoints declared in IaC
  { provider: "openai", pattern: /resource\s+"aws_bedrock_/i },
  { provider: "google", pattern: /resource\s+"google_vertex_ai_/i },
  { provider: "openai", pattern: /resource\s+"azurerm_cognitive_/i },
];

/**
 * Env var names that indicate "this project uses AI". A match in
 * `.env.example`, `docker-compose.yml`, or `.github/workflows/*.yml`
 * is a strong hidden-AI signal even without any code hits.
 *
 * Each pattern matches both `VAR=value` (dotenv / bash syntax) and
 * `VAR: value` (YAML syntax for GitHub Actions / Docker compose /
 * Kubernetes manifests). A trailing `[=:]` after the var name is the
 * key separator — we allow either.
 *
 * The `-` prefix handling covers the YAML sequence form
 * `- OPENAI_API_KEY=...` used by some Compose variants.
 */
export const AI_ENV_VAR_PATTERNS: Array<{ provider: string; pattern: RegExp }> = [
  { provider: "openai", pattern: /(^|\n)\s*-?\s*OPENAI_API_KEY\s*[=:]/i },
  { provider: "openai", pattern: /(^|\n)\s*-?\s*AZURE_OPENAI_(API_KEY|ENDPOINT|DEPLOYMENT)\s*[=:]/i },
  { provider: "openai", pattern: /(^|\n)\s*-?\s*OPENAI_ORG(ANIZATION)?\s*[=:]/i },
  { provider: "anthropic", pattern: /(^|\n)\s*-?\s*ANTHROPIC_API_KEY\s*[=:]/i },
  { provider: "anthropic", pattern: /(^|\n)\s*-?\s*CLAUDE_API_KEY\s*[=:]/i },
  { provider: "google", pattern: /(^|\n)\s*-?\s*(GOOGLE_AI|GEMINI|GOOGLE_GENERATIVE_AI)_API_KEY\s*[=:]/i },
  { provider: "google", pattern: /(^|\n)\s*-?\s*VERTEX_AI_(PROJECT|LOCATION)\s*[=:]/i },
  { provider: "huggingface", pattern: /(^|\n)\s*-?\s*(HUGGINGFACE|HF)_(API_KEY|TOKEN|HUB_TOKEN)\s*[=:]/i },
  { provider: "cohere", pattern: /(^|\n)\s*-?\s*COHERE_API_KEY\s*[=:]/i },
  { provider: "replicate", pattern: /(^|\n)\s*-?\s*REPLICATE_API_(TOKEN|KEY)\s*[=:]/i },
  { provider: "groq", pattern: /(^|\n)\s*-?\s*GROQ_API_KEY\s*[=:]/i },
  { provider: "together-ai", pattern: /(^|\n)\s*-?\s*TOGETHER_(AI_)?API_KEY\s*[=:]/i },
  { provider: "mistral", pattern: /(^|\n)\s*-?\s*MISTRAL_API_KEY\s*[=:]/i },
  { provider: "perplexity", pattern: /(^|\n)\s*-?\s*PERPLEXITY_API_KEY\s*[=:]/i },
  { provider: "openrouter", pattern: /(^|\n)\s*-?\s*OPENROUTER_API_KEY\s*[=:]/i },
  { provider: "ollama", pattern: /(^|\n)\s*-?\s*OLLAMA_(HOST|BASE_URL)\s*[=:]/i },
];

export interface ManifestMatch {
  provider: string;
  /** Which manifest file produced the match. */
  manifestPath: string;
}

/**
 * Extract every AI dependency match from a manifest file's text.
 * Returns a list (duplicates deduped) so the caller can summarize
 * "this project declares N AI providers".
 */
export function extractAIDependenciesFromManifest(
  manifestPath: string,
  content: string,
): ManifestMatch[] {
  const seen = new Set<string>();
  const matches: ManifestMatch[] = [];
  for (const dep of AI_DEPENDENCY_PATTERNS) {
    if (dep.pattern.test(content)) {
      if (seen.has(dep.provider)) continue;
      seen.add(dep.provider);
      matches.push({ provider: dep.provider, manifestPath });
    }
  }
  return matches;
}

/**
 * Extract every AI env-var match from a `.env.example`-shaped file.
 * Duplicates (same provider seen twice) are deduped.
 */
export function extractAIEnvVarsFromFile(content: string): string[] {
  const seen = new Set<string>();
  for (const { provider, pattern } of AI_ENV_VAR_PATTERNS) {
    if (pattern.test(content)) seen.add(provider);
  }
  return Array.from(seen);
}

/**
 * Manifest files we check per repo. Order matters — we stop at the
 * first one we find per ecosystem so we don't double-count a project
 * that lists the same dependency in both pyproject.toml and
 * requirements.txt.
 *
 * The list includes non-traditional "manifests" — Dockerfiles and
 * Terraform files aren't dependency manifests in the classic sense,
 * but they are the canonical place an engineer declares infrastructure
 * that uses AI (model containers, cloud LLM endpoints). Treating them
 * in the same sweep catches the cron/infra cases where a customer's
 * AI usage isn't in any package file at all.
 */
export const AI_MANIFEST_PATHS: readonly string[] = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "poetry.lock",
  "go.mod",
  "Gemfile",
  "composer.json",
  "Cargo.toml",
  "build.gradle",
  "pom.xml",
  // JVM Kotlin
  "build.gradle.kts",
  // Elixir
  "mix.exs",
  // Infrastructure — common locations only
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yaml",
  "main.tf",
  "infrastructure/main.tf",
  "terraform/main.tf",
];

/**
 * Env-var-shaped files. Any of these may contain `OPENAI_API_KEY=...`
 * or a YAML equivalent. GitHub Actions workflow files and docker-compose
 * files are included alongside the traditional `.env.example` paths so
 * the single pass catches "we declared OPENAI_API_KEY as a secret in
 * our CI" as a hidden-AI signal.
 */
export const ENV_EXAMPLE_PATHS: readonly string[] = [
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
  "env.example",
  // Common GitHub Actions entry points — wildcard search isn't
  // available via the REST API, so we check the conventional names.
  // If a real workflow file lives elsewhere, the /api/sdk/... code-
  // search pass will still catch env var mentions in it.
  ".github/workflows/ci.yml",
  ".github/workflows/ci.yaml",
  ".github/workflows/test.yml",
  ".github/workflows/deploy.yml",
  ".github/workflows/main.yml",
  ".github/workflows/release.yml",
  // Docker compose env blocks
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yaml",
];

/**
 * Lightweight framework/catalog repo detector. Mirrors the heavier
 * version in lib/scanner/detection-classes.ts but kept here so the
 * connector path doesn't need to import from the scanner path (they're
 * independent subsystems). Conservative — if in doubt, return false and
 * let the normal flow handle it.
 */
export function looksLikeAIFrameworkRepo(repo: {
  name?: string;
  full_name?: string;
  description?: string | null;
}): { isFramework: boolean; reason?: string } {
  const name = (repo.name ?? "").toLowerCase();
  const fullName = (repo.full_name ?? "").toLowerCase();
  const desc = (repo.description ?? "").toLowerCase();

  const framePatterns: RegExp[] = [
    /\blangchain\b/,
    /\blanggraph\b/,
    /\blangflow\b/,
    /\bllamaindex\b/,
    /\bhaystack\b/,
    /\bautogen\b/,
    /\bcrewai\b/,
    /\bauto[-_]?gpt\b/,
    /\b(awesome|best)[-_](llm|ai|agent|ml)\b/,
    /\bopenai[-_](cookbook|python|node|agents|sdk)\b/,
    /^llm[-_]/,
    /[-_]llm$/,
  ];
  for (const p of framePatterns) {
    if (p.test(name) || p.test(fullName)) {
      return { isFramework: true, reason: "Repository name matches a known AI framework pattern." };
    }
  }

  if (/\b(framework|library|sdk|toolkit)\b.*\b(ai|llm|agent)\b/.test(desc) ||
      /\b(ai|llm|agent)\b.*\b(framework|library|sdk|toolkit)\b/.test(desc) ||
      /awesome list|curated (list|collection)|cookbook|examples? and tutorials?/.test(desc)) {
    return {
      isFramework: true,
      reason: "Repository description indicates it is an AI framework, library, or educational collection.",
    };
  }

  return { isFramework: false };
}

export function buildNormalizedAsset(overrides: Partial<NormalizedAsset> & Pick<NormalizedAsset, "externalId" | "name">): NormalizedAsset {
  return {
    description: undefined,
    kind: "unknown",
    environment: "unknown",
    ownerEmail: undefined,
    aiServices: [],
    dataClassification: [],
    tags: [],
    rawMetadata: {},
    ...overrides,
  };
}
