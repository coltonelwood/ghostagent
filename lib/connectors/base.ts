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
