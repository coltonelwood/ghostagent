import type { ConnectorKind } from "../types/platform";
import type { NexusConnector } from "./base";
import { GitHubConnector } from "./github";
import { GitLabConnector } from "./gitlab";
import { BitbucketConnector } from "./bitbucket";
import { AWSConnector } from "./aws";
import { GCPConnector } from "./gcp";
import { AzureConnector } from "./azure";
import { ZapierConnector } from "./zapier";
import { N8nConnector } from "./n8n";
import { MakeConnector } from "./make";
import { RipplingConnector } from "./rippling";
import { BambooHRConnector } from "./bamboohr";
import { WorkdayConnector } from "./workday";
import { SDKConnector } from "./sdk";
import { SlackConnector } from "./slack";
import { WebhookConnector } from "./webhook";

// Registry of all connector implementations
const CONNECTORS: Partial<Record<ConnectorKind, NexusConnector>> = {
  github: new GitHubConnector(),
  gitlab: new GitLabConnector(),
  bitbucket: new BitbucketConnector(),
  aws: new AWSConnector(),
  gcp: new GCPConnector(),
  azure: new AzureConnector(),
  zapier: new ZapierConnector(),
  n8n: new N8nConnector(),
  make: new MakeConnector(),
  rippling: new RipplingConnector(),
  bamboohr: new BambooHRConnector(),
  workday: new WorkdayConnector(),
  sdk: new SDKConnector(),
  slack: new SlackConnector(),
  webhook: new WebhookConnector(),
};

export function getConnector(kind: ConnectorKind): NexusConnector {
  const connector = CONNECTORS[kind];
  if (!connector) throw new Error(`No connector implementation for kind: ${kind}`);
  return connector;
}

export function listConnectors(): NexusConnector[] {
  return Object.values(CONNECTORS).filter(Boolean) as NexusConnector[];
}

export * from "./base";
export * from "./github";
export * from "./gitlab";
export * from "./bitbucket";
export * from "./aws";
export * from "./gcp";
export * from "./azure";
export * from "./zapier";
export * from "./n8n";
export * from "./make";
export * from "./rippling";
export * from "./bamboohr";
export * from "./workday";
export * from "./sdk";
export * from "./slack";
export * from "./webhook";
