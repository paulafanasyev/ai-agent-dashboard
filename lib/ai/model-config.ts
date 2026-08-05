/**
 * File: lib/ai/model-config.ts
 * Purpose: Define, validate, migrate, and label client-selectable model configurations.
 * Problem solved: Keeps BYOK provider data safe, typed, and compatible across browser sessions.
 */
export const DEFAULT_KIMI_MODEL_ID = "k3";
export const DEFAULT_ANTHROPIC_MODEL_ID = "claude-sonnet-4-5-20250929";
export const DEFAULT_DEEPSEEK_MODEL_ID = "deepseek-v4-flash";
export const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const PROJECT_CLAUDE_CONFIG_ID = "project-claude";

export type KimiReasoningEffort = "low" | "high" | "max";
export type DeepSeekThinkingMode = "disabled" | "enabled";

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
      provider: "deepseek";
      apiKey: string;
      modelId: string;
      thinkingMode: DeepSeekThinkingMode;
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
export const API_CONFIGS_STORAGE_KEY = "ai-agent-dashboard:api-configs:v1";

export type ApiConfigProfile = {
  id: string;
  name: string;
  config: Exclude<ClientModelConfig, { provider: "anthropic" }>;
};

export type ApiConfigState = {
  profiles: ApiConfigProfile[];
};

export type SelectableApiConfig = {
  id: string;
  name: string;
  config: ClientModelConfig;
  builtIn: boolean;
};

export const EMPTY_API_CONFIG_STATE: ApiConfigState = {
  profiles: [],
};

/** Narrows untrusted stored values to the reasoning levels accepted by the Kimi API. */
export function isKimiReasoningEffort(
  value: string,
): value is KimiReasoningEffort {
  return value === "low" || value === "high" || value === "max";
}

/** Narrows stored values to the two thinking modes accepted by DeepSeek V4. */
export function isDeepSeekThinkingMode(
  value: string,
): value is DeepSeekThinkingMode {
  return value === "disabled" || value === "enabled";
}

/**
 * Accepts only public HTTPS provider endpoints and rejects obvious loopback/private targets.
 * This is a validation layer, not a replacement for deployment-level outbound network policy.
 */
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

/** Detects both first-class and legacy custom profiles that target DeepSeek's official API. */
export function isDeepSeekModelConfig(config: ClientModelConfig) {
  if (config.provider === "deepseek") return true;
  if (config.provider !== "custom") return false;

  try {
    return new URL(config.baseUrl).origin === new URL(DEEPSEEK_BASE_URL).origin;
  } catch {
    return false;
  }
}

/** Resolves DeepSeek request mode, treating legacy compatible profiles as non-thinking. */
export function deepSeekThinkingMode(config: ClientModelConfig) {
  if (config.provider === "deepseek") return config.thinkingMode;
  return isDeepSeekModelConfig(config) ? ("disabled" as const) : null;
}

/** Produces a credential-free provider/model label safe for rendering in Settings. */
export function modelConfigLabel(config: ClientModelConfig) {
  if (config.provider === "kimi") return `Kimi · ${config.modelId}`;
  if (config.provider === "deepseek") return `DeepSeek · ${config.modelId}`;
  if (config.provider === "custom") return config.modelId;
  if (config.provider === "anthropic-byok") {
    return `Anthropic · ${config.modelId}`;
  }
  return "Claude";
}

/** Returns a short provider name for profile menus without exposing credentials. */
export function modelProviderLabel(config: ClientModelConfig) {
  if (config.provider === "anthropic" || config.provider === "anthropic-byok") {
    return "Anthropic";
  }
  if (config.provider === "kimi") return "Kimi";
  if (config.provider === "deepseek") return "DeepSeek";
  return "OpenAI-compatible";
}

/** Validates and migrates a tab-scoped model draft before it enters React state. */
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
    candidate.provider === "deepseek" &&
    typeof candidate.apiKey === "string" &&
    typeof candidate.modelId === "string" &&
    candidate.modelId.trim().length > 0
  ) {
    return {
      provider: "deepseek",
      apiKey: candidate.apiKey,
      modelId: candidate.modelId.trim(),
      thinkingMode:
        typeof candidate.thinkingMode === "string" &&
        isDeepSeekThinkingMode(candidate.thinkingMode)
          ? candidate.thinkingMode
          : "disabled",
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
    const customConfig: Extract<ClientModelConfig, { provider: "custom" }> = {
      provider: "custom",
      apiKey: candidate.apiKey,
      baseUrl: candidate.baseUrl.trim(),
      modelId: candidate.modelId.trim(),
    };

    // DeepSeek used to be configured through the generic compatible-provider form.
    // Normalize those profiles so provider-specific request compatibility applies.
    if (isDeepSeekModelConfig(customConfig)) {
      return {
        provider: "deepseek",
        apiKey: customConfig.apiKey,
        modelId: customConfig.modelId,
        thinkingMode: "disabled",
      };
    }

    return customConfig;
  }

  return null;
}

/** Validates the tab-scoped multi-profile payload without allowing Project Claude into BYOK storage. */
export function parseStoredApiConfigState(value: unknown): ApiConfigState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.profiles)) return null;

  const profiles: ApiConfigProfile[] = [];
  const ids = new Set<string>();
  for (const rawProfile of candidate.profiles) {
    if (typeof rawProfile !== "object" || rawProfile === null) return null;
    const profile = rawProfile as Record<string, unknown>;
    if (
      typeof profile.id !== "string" ||
      !profile.id.trim() ||
      ids.has(profile.id) ||
      profile.id === PROJECT_CLAUDE_CONFIG_ID
    ) {
      return null;
    }
    const config = parseStoredModelConfig(profile.config);
    if (!config || config.provider === "anthropic") return null;
    ids.add(profile.id);
    profiles.push({
      id: profile.id,
      name: config.modelId,
      config,
    });
  }

  return { profiles };
}

/** Gives a migrated single-provider setting a useful editable profile name. */
export function defaultApiConfigName(config: ClientModelConfig) {
  return config.provider === "anthropic" ? "Project Claude" : config.modelId;
}
