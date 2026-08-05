/**
 * File: tests/unit/browser-routing.test.ts
 * Purpose: Verify visible-browser intent and provider-compatible first-step tool selection.
 * Problem solved: Prevents DeepSeek Thinking requests from regressing to an invalid tool_choice field.
 */

import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { initialToolChoice } from "@/lib/ai/browser-routing";

function userMessage(text: string) {
  return [{ id: "user-1", role: "user", parts: [{ type: "text", text }] }] as UIMessage[];
}

describe("initial tool choice", () => {
  it("omits tool_choice when DeepSeek thinking is enabled", () => {
    const messages = userMessage("What's the weather in Dubai?");

    expect(
      initialToolChoice(messages, {
        provider: "deepseek",
        apiKey: "sk-deepseek-test",
        modelId: "deepseek-v4-flash",
        thinkingMode: "enabled",
      }),
    ).toBeUndefined();
  });

  it("can force visible tools when DeepSeek thinking is disabled", () => {
    const messages = userMessage("What's the weather in Dubai?");

    expect(
      initialToolChoice(messages, {
        provider: "deepseek",
        apiKey: "sk-deepseek-test",
        modelId: "deepseek-v4-flash",
        thinkingMode: "disabled",
      }),
    ).toEqual({ type: "tool", toolName: "computer" });
    expect(
      initialToolChoice(messages, {
        provider: "custom",
        apiKey: "sk-deepseek-legacy",
        baseUrl: "https://api.deepseek.com/v1",
        modelId: "deepseek-v4-pro",
      }),
    ).toEqual({ type: "tool", toolName: "computer" });
  });

  it("still forces the visible computer for browser tasks on supported providers", () => {
    expect(
      initialToolChoice(userMessage("What's the weather in Dubai?"), {
        provider: "kimi",
        apiKey: "sk-kimi-test",
        modelId: "k3",
        reasoningEffort: "high",
      }),
    ).toEqual({ type: "tool", toolName: "computer" });
  });

  it("keeps automatic selection for non-browser tasks", () => {
    expect(
      initialToolChoice(userMessage("Summarize the attached notes"), {
        provider: "anthropic",
      }),
    ).toBe("auto");
  });
});
