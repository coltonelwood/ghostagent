/**
 * threat-intelligence/ai-provider.ts — Configurable AI provider abstraction
 *
 * Supports both OpenAI and Anthropic Claude for behavioral fingerprint
 * extraction. Provider is selected via THREAT_AI_PROVIDER env var
 * (defaults to "openai").
 *
 * Uses the same lazy-singleton pattern as the scanner (see scanner/index.ts).
 */

import type OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { scanLogger as logger } from "../logger";

// ─── INTERFACE ───────────────────────────────────────────────────────────────

export interface ThreatAIProvider {
  analyze(systemPrompt: string, userPrompt: string): Promise<string>;
}

// ─── OPENAI PROVIDER ─────────────────────────────────────────────────────────

function getOpenAIProvider(): ThreatAIProvider {
  let client: OpenAI | null = null;
  return {
    async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
      if (!client) {
        const OpenAI = (await import("openai")).default;
        client = new OpenAI();
      }
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      return response.choices[0]?.message?.content ?? "{}";
    },
  };
}

// ─── ANTHROPIC PROVIDER ──────────────────────────────────────────────────────

function getAnthropicProvider(): ThreatAIProvider {
  let client: Anthropic | null = null;
  return {
    async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
      if (!client) {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        client = new Anthropic();
      }
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = response.content.find(
        (b: { type: string }) => b.type === "text",
      );
      return (textBlock as { type: "text"; text: string } | undefined)?.text ?? "{}";
    },
  };
}

// ─── PROVIDER FACTORY ────────────────────────────────────────────────────────

let _provider: ThreatAIProvider | null = null;

export function getAIProvider(): ThreatAIProvider {
  if (!_provider) {
    const providerName = process.env.THREAT_AI_PROVIDER ?? "openai";
    logger.info(
      { provider: providerName },
      "threat-intelligence AI provider initialized",
    );
    _provider =
      providerName === "anthropic"
        ? getAnthropicProvider()
        : getOpenAIProvider();
  }
  return _provider;
}
