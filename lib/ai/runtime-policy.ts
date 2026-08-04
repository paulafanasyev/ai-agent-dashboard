/**
 * File: lib/ai/runtime-policy.ts
 * Purpose: Keep shared project credentials local while making hosted deployments BYOK-only.
 * Problem solved: Prevents public deployments from spending an operator's shared Claude credentials.
 */

export interface ModelCapabilities {
  projectClaudeAvailable: boolean;
  accessMode: "local-project-or-byok" | "byok-only";
}

/** Derives access policy from environment presence without exposing any credential value. */
export function resolveModelCapabilities(
  environment: Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL" | "ANTHROPIC_API_KEY">,
): ModelCapabilities {
  const projectClaudeAvailable =
    environment.NODE_ENV === "development" &&
    environment.VERCEL !== "1" &&
    Boolean(environment.ANTHROPIC_API_KEY?.trim());

  return {
    projectClaudeAvailable,
    accessMode: projectClaudeAvailable
      ? "local-project-or-byok"
      : "byok-only",
  };
}

/** Reads the current server environment and returns the canonical model access policy. */
export function getServerModelCapabilities() {
  return resolveModelCapabilities({
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
}
