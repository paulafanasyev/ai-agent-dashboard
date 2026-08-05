/**
 * File: tests/unit/model-config.test.ts
 * Purpose: Verify multi-profile parsing, DeepSeek defaults, and unsafe stored payload rejection.
 * Problem solved: Protects tab-scoped credential migration from malformed or ambiguous data.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEEPSEEK_MODEL_ID,
  isDeepSeekModelConfig,
  parseStoredApiConfigState,
  parseStoredModelConfig,
} from "@/lib/ai/model-config";

describe("API model configuration", () => {
  it("parses a DeepSeek profile and preserves the selected default", () => {
    const parsed = parseStoredApiConfigState({
      profiles: [
        {
          id: "deepseek-work",
          name: "Old custom label",
          config: {
            provider: "deepseek",
            apiKey: "sk-deepseek-test",
            modelId: DEFAULT_DEEPSEEK_MODEL_ID,
          },
        },
      ],
      defaultConfigId: "deepseek-work",
    });

    expect(parsed).toEqual({
      profiles: [
        {
          id: "deepseek-work",
          name: "deepseek-v4-flash",
          config: {
            provider: "deepseek",
            apiKey: "sk-deepseek-test",
            modelId: "deepseek-v4-flash",
            thinkingMode: "disabled",
          },
        },
      ],
      defaultConfigId: "deepseek-work",
    });
  });

  it("falls back to the first valid profile when a stored default was deleted", () => {
    const parsed = parseStoredApiConfigState({
      profiles: [
        {
          id: "kimi-main",
          name: "Kimi",
          config: {
            provider: "kimi",
            apiKey: "sk-kimi-test",
            modelId: "k3",
            reasoningEffort: "high",
          },
        },
      ],
      defaultConfigId: "deleted-profile",
    });

    expect(parsed?.defaultConfigId).toBe("kimi-main");
  });

  it("rejects duplicate IDs and Project Claude credentials in BYOK storage", () => {
    const profile = {
      id: "duplicate",
      name: "Anthropic",
      config: {
        provider: "anthropic-byok",
        apiKey: "sk-anthropic-test",
        modelId: "claude-test",
      },
    };
    expect(
      parseStoredApiConfigState({
        profiles: [profile, profile],
        defaultConfigId: "duplicate",
      }),
    ).toBeNull();
    expect(
      parseStoredApiConfigState({
        profiles: [
          {
            id: "project-claude",
            name: "Fake project key",
            config: { provider: "anthropic" },
          },
        ],
        defaultConfigId: "project-claude",
      }),
    ).toBeNull();
  });

  it("continues to parse legacy single-provider settings", () => {
    expect(
      parseStoredModelConfig({
        provider: "anthropic-byok",
        apiKey: "sk-legacy-test",
        modelId: "claude-legacy",
      }),
    ).toMatchObject({ provider: "anthropic-byok", modelId: "claude-legacy" });
  });

  it("migrates a legacy custom DeepSeek endpoint to the first-class provider", () => {
    expect(
      parseStoredModelConfig({
        provider: "custom",
        apiKey: "sk-deepseek-legacy",
        baseUrl: "https://api.deepseek.com/v1",
        modelId: "deepseek-v4-pro",
      }),
    ).toEqual({
      provider: "deepseek",
      apiKey: "sk-deepseek-legacy",
      modelId: "deepseek-v4-pro",
      thinkingMode: "disabled",
    });
  });

  it("recognizes official DeepSeek configs without misclassifying other compatible APIs", () => {
    expect(
      isDeepSeekModelConfig({
        provider: "deepseek",
        apiKey: "sk-deepseek-test",
        modelId: "deepseek-v4-flash",
        thinkingMode: "disabled",
      }),
    ).toBe(true);
    expect(
      isDeepSeekModelConfig({
        provider: "custom",
        apiKey: "sk-deepseek-legacy",
        baseUrl: "https://api.deepseek.com/v1",
        modelId: "deepseek-v4-pro",
      }),
    ).toBe(true);
    expect(
      isDeepSeekModelConfig({
        provider: "custom",
        apiKey: "sk-compatible-test",
        baseUrl: "https://api.example.com/v1",
        modelId: "example-model",
      }),
    ).toBe(false);
  });

  it("preserves an explicitly enabled DeepSeek thinking mode", () => {
    expect(
      parseStoredModelConfig({
        provider: "deepseek",
        apiKey: "sk-deepseek-test",
        modelId: "deepseek-v4-pro",
        thinkingMode: "enabled",
      }),
    ).toMatchObject({ provider: "deepseek", thinkingMode: "enabled" });
  });
});
