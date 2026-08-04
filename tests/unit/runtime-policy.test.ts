/**
 * File: tests/unit/runtime-policy.test.ts
 * Purpose: Verify local Project Claude and hosted BYOK access rules.
 * Problem solved: Prevents deployment changes from exposing shared model credentials to public users.
 */

import { describe, expect, it } from "vitest";
import { resolveModelCapabilities } from "@/lib/ai/runtime-policy";

describe("model runtime policy", () => {
  it("allows a shared Claude key only in local development", () => {
    expect(
      resolveModelCapabilities({
        NODE_ENV: "development",
        VERCEL: undefined,
        ANTHROPIC_API_KEY: "sk-ant-local",
      }),
    ).toEqual({
      projectClaudeAvailable: true,
      accessMode: "local-project-or-byok",
    });
  });

  it("forces BYOK in production even when a shared key exists", () => {
    expect(
      resolveModelCapabilities({
        NODE_ENV: "production",
        VERCEL: "1",
        ANTHROPIC_API_KEY: "sk-ant-shared",
      }),
    ).toEqual({
      projectClaudeAvailable: false,
      accessMode: "byok-only",
    });
  });

  it("requires BYOK when local development has no project key", () => {
    expect(
      resolveModelCapabilities({
        NODE_ENV: "development",
        VERCEL: undefined,
        ANTHROPIC_API_KEY: undefined,
      }).projectClaudeAvailable,
    ).toBe(false);
  });
});
