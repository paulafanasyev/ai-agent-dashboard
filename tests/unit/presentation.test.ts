/**
 * File: tests/unit/presentation.test.ts
 * Purpose: Verify model endpoint changes invalidate the active chat controller.
 * Problem solved: Prevents an edited Provider Base URL from reusing a controller bound to the old endpoint.
 */

import { describe, expect, it } from "vitest";
import type { ClientModelConfig } from "@/lib/ai/model-config";
import { modelEndpointSignature } from "@/lib/dashboard/presentation";

type EditableConfig = Exclude<ClientModelConfig, { provider: "anthropic" }>;

describe("modelEndpointSignature", () => {
  it.each<EditableConfig>([
    {
      provider: "anthropic-byok",
      apiKey: "sk-anthropic-test",
      baseUrl: "https://anthropic.example.com/v1",
      modelId: "claude-test",
    },
    {
      provider: "kimi",
      apiKey: "sk-kimi-test",
      baseUrl: "https://kimi.example.com/v1",
      modelId: "k3",
      reasoningEffort: "high",
    },
    {
      provider: "deepseek",
      apiKey: "sk-deepseek-test",
      baseUrl: "https://deepseek.example.com/v1",
      modelId: "deepseek-test",
      thinkingMode: "disabled",
    },
    {
      provider: "custom",
      apiKey: "sk-compatible-test",
      baseUrl: "https://compatible.example.com/v1",
      modelId: "compatible-test",
    },
  ])("includes the $provider Base URL", (config) => {
    expect(modelEndpointSignature(config)).toContain(config.baseUrl);
  });
});
