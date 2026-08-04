/**
 * File: lib/ai/anthropic.ts
 * Purpose: Configure the server-side Anthropic provider and selected Claude model.
 * Problem solved: Supports official or compatible Anthropic endpoints without leaking credentials to the client.
 */
import { createAnthropic } from "@ai-sdk/anthropic";

const configuredBaseURL = process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "");

export const anthropicProvider = createAnthropic({
  baseURL: configuredBaseURL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const anthropicModelId =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
