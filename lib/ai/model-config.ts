/**
 * File: lib/ai/model-config.ts
 * Purpose: Define, validate, migrate, and label client-selectable model configurations.
 * Problem solved: Keeps BYOK provider data safe, typed, and compatible across browser sessions.
 */
export const DEFAULT_KIMI_MODEL_ID = "k3";
export const DEFAULT_ANTHROPIC_MODEL_ID = "claude-sonnet-4-5-20250929";
export const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";

export type KimiReasoningEffort = "low" | "high" | "max";

export type ClientModelConfig =
  | {
      provider: "anthropic";
    }
  | {
      provider: "anthropic-byok";
      apiKey: string;
      modelId: string;
    }
  | {
      provider: "kimi";
      apiKey: string;
      modelId: string;
      reasoningEffort: KimiReasoningEffort;
    }
  | {
      provider: "custom";
      apiKey: string;
      baseUrl: string;
      modelId: string;
    };

export const DEFAULT_MODEL_CONFIG: ClientModelConfig = {
  provider: "anthropic",
};

export const MODEL_SETTINGS_STORAGE_KEY = "ai-agent-dashboard:model-config";

export function isKimiReasoningEffort(
  value: string,
): value is KimiReasoningEffort {
  return value === "low" || value === "high" || value === "max";
}

export function isSafeCustomBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.startsWith("[") ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe80:")
    ) {
      return false;
    }

    const octets = hostname.split(".").map(Number);
    if (octets.length === 4 && octets.every(Number.isInteger)) {
      const [first, second] = octets;
      if (
        first === 10 ||
        first === 127 ||
        first === 0 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function modelConfigLabel(config: ClientModelConfig) {
  if (config.provider === "kimi") return `Kimi · ${config.modelId}`;
  if (config.provider === "custom") return config.modelId;
  if (config.provider === "anthropic-byok") {
    return `Anthropic · ${config.modelId}`;
  }
  return "Claude";
}

export function parseStoredModelConfig(
  value: unknown,
): ClientModelConfig | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (candidate.provider === "anthropic") return { provider: "anthropic" };

  if (
    candidate.provider === "anthropic-byok" &&
    typeof candidate.apiKey === "string" &&
    typeof candidate.modelId === "string" &&
    candidate.modelId.trim().length > 0
  ) {
    return {
      provider: "anthropic-byok",
      apiKey: candidate.apiKey,
      modelId: candidate.modelId.trim(),
    };
  }

  if (
    candidate.provider === "kimi" &&
    typeof candidate.apiKey === "string" &&
    typeof candidate.reasoningEffort === "string" &&
    isKimiReasoningEffort(candidate.reasoningEffort)
  ) {
    return {
      provider: "kimi",
      apiKey: candidate.apiKey,
      modelId:
        typeof candidate.modelId === "string" && candidate.modelId.trim()
          ? candidate.modelId.trim()
          : DEFAULT_KIMI_MODEL_ID,
      reasoningEffort: candidate.reasoningEffort,
    };
  }

  if (
    candidate.provider === "custom" &&
    typeof candidate.apiKey === "string" &&
    typeof candidate.baseUrl === "string" &&
    isSafeCustomBaseUrl(candidate.baseUrl) &&
    typeof candidate.modelId === "string" &&
    candidate.modelId.trim().length > 0
  ) {
    return {
      provider: "custom",
      apiKey: candidate.apiKey,
      baseUrl: candidate.baseUrl,
      modelId: candidate.modelId,
    };
  }

  return null;
}
