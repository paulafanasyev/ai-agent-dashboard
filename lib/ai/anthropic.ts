/**
 * File: lib/ai/anthropic.ts
 * Purpose: Configure the server-side Anthropic provider and selected Claude model.
 * Problem solved: Supports official or compatible Anthropic endpoints without leaking credentials to the client.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { DEFAULT_ANTHROPIC_MODEL_ID } from "@/lib/ai/model-config";

const configuredBaseURL = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");

export const anthropicProvider = createAnthropic({
  baseURL: configuredBaseURL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const anthropicModelId =
  process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL_ID;

export function createAnthropicByokModel(apiKey: string, modelId: string) {
  return createAnthropic({ apiKey })(modelId);
}
