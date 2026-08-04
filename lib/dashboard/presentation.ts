/**
 * File: lib/dashboard/presentation.ts
 * Purpose: Provide stable labels and keys for dashboard presentation.
 * Problem solved: Keeps display naming and remount decisions out of stateful UI components.
 */
import type { UIMessage } from "ai";
import type { ClientModelConfig } from "@/lib/ai/model-config";

/** Identifies provider endpoint changes that require remounting and clearing the active chat. */
export function modelEndpointSignature(config: ClientModelConfig) {
  if (config.provider === "kimi") return `${config.provider}:${config.modelId}`;
  if (config.provider === "anthropic-byok") {
    return `${config.provider}:${config.modelId}`;
  }
  if (config.provider === "custom") {
    return `${config.provider}:${config.baseUrl}:${config.modelId}`;
  }
  return config.provider;
}

/** Derives a short Conversation title from the first meaningful user message. */
export function firstUserMessageTitle(messages: UIMessage[]) {
  const message = messages.find((item) => item.role === "user");
  if (!message) return null;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  if (!text) return null;
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}
