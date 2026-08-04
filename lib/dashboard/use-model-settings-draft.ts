/**
 * File: lib/dashboard/use-model-settings-draft.ts
 * Purpose: Own validation and autosave for the settings model configuration draft.
 * Problem solved: Prevents incomplete credentials from replacing the last valid provider configuration.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  isSafeCustomBaseUrl,
  type ClientModelConfig,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import type { SaveState } from "@/components/settings/settings-primitives";

export type AccessMode = "project" | "byok";
export type ByokProvider = "anthropic-byok" | "kimi" | "custom";

interface ModelSettingsDraftOptions {
  config: ClientModelConfig;
  isOpen: boolean;
  modelDisabled: boolean;
  projectClaudeAvailable: boolean;
  onConfigChange: (config: ClientModelConfig) => void;
}

function sameConfig(left: ClientModelConfig, right: ClientModelConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function byokProviderForConfig(config: ClientModelConfig): ByokProvider {
  if (config.provider === "anthropic-byok") return "anthropic-byok";
  if (config.provider === "kimi") return "kimi";
  if (config.provider === "custom") return "custom";
  return "anthropic-byok";
}

/** Validates provider fields and autosaves only complete configurations after a short debounce. */
export function useModelSettingsDraft({
  config,
  isOpen,
  modelDisabled,
  projectClaudeAvailable,
  onConfigChange,
}: ModelSettingsDraftOptions) {
  const [accessMode, setAccessMode] = useState<AccessMode>(
    config.provider === "anthropic" && projectClaudeAvailable
      ? "project"
      : "byok",
  );
  const [byokProvider, setByokProvider] = useState<ByokProvider>(
    byokProviderForConfig(config),
  );
  const [apiKey, setApiKey] = useState(
    config.provider !== "anthropic" ? config.apiKey : "",
  );
  const [reasoningEffort, setReasoningEffort] =
    useState<KimiReasoningEffort>(
      config.provider === "kimi" ? config.reasoningEffort : "high",
    );
  const [kimiModelId, setKimiModelId] = useState(
    config.provider === "kimi" ? config.modelId : DEFAULT_KIMI_MODEL_ID,
  );
  const [anthropicModelId, setAnthropicModelId] = useState(
    config.provider === "anthropic-byok"
      ? config.modelId
      : DEFAULT_ANTHROPIC_MODEL_ID,
  );
  const [customBaseUrl, setCustomBaseUrl] = useState(
    config.provider === "custom" ? config.baseUrl : "",
  );
  const [customModelId, setCustomModelId] = useState(
    config.provider === "custom" ? config.modelId : "",
  );
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  /** Converts field state into either one complete ClientModelConfig or an actionable validation error. */
  const draftResult = useMemo<
    { config: ClientModelConfig; error: null } | { config: null; error: string }
  >(() => {
    if (accessMode === "project") {
      if (!projectClaudeAvailable) {
        return { config: null, error: "Project Claude is unavailable here." };
      }
      return { config: { provider: "anthropic" }, error: null };
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 8) {
      return {
        config: null,
        error: "Enter an API key with at least 8 characters.",
      };
    }

    if (byokProvider === "anthropic-byok") {
      const modelId = anthropicModelId.trim();
      if (!modelId) {
        return { config: null, error: "Enter the Anthropic model ID." };
      }
      return {
        config: { provider: "anthropic-byok", apiKey: trimmedKey, modelId },
        error: null,
      };
    }

    if (byokProvider === "custom") {
      const baseUrl = customBaseUrl.trim().replace(/\/$/, "");
      const modelId = customModelId.trim();
      if (!isSafeCustomBaseUrl(baseUrl)) {
        return { config: null, error: "Enter a public HTTPS Base URL." };
      }
      if (!modelId) {
        return { config: null, error: "Enter the custom model ID." };
      }
      return {
        config: { provider: "custom", apiKey: trimmedKey, baseUrl, modelId },
        error: null,
      };
    }

    const modelId = kimiModelId.trim();
    if (!modelId) {
      return { config: null, error: "Enter the Kimi model ID." };
    }
    return {
      config: {
        provider: "kimi",
        apiKey: trimmedKey,
        modelId,
        reasoningEffort,
      },
      error: null,
    };
  }, [
    accessMode,
    anthropicModelId,
    apiKey,
    byokProvider,
    customBaseUrl,
    customModelId,
    kimiModelId,
    projectClaudeAvailable,
    reasoningEffort,
  ]);

  useEffect(() => {
    if (!isOpen || modelDisabled) return;
    if (!draftResult.config) {
      setSaveState("incomplete");
      return;
    }
    if (sameConfig(draftResult.config, config)) {
      setSaveState("saved");
      return;
    }
    setSaveState("pending");
    const timeout = window.setTimeout(() => {
      onConfigChange(draftResult.config);
      setSaveState("saved");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [config, draftResult, isOpen, modelDisabled, onConfigChange]);

  /** Restores every form field from the last applied configuration when Settings opens. */
  const resetDraft = useCallback(() => {
    setAccessMode(
      config.provider === "anthropic" && projectClaudeAvailable
        ? "project"
        : "byok",
    );
    setByokProvider(byokProviderForConfig(config));
    setApiKey(config.provider !== "anthropic" ? config.apiKey : "");
    setReasoningEffort(
      config.provider === "kimi" ? config.reasoningEffort : "high",
    );
    setKimiModelId(
      config.provider === "kimi" ? config.modelId : DEFAULT_KIMI_MODEL_ID,
    );
    setAnthropicModelId(
      config.provider === "anthropic-byok"
        ? config.modelId
        : DEFAULT_ANTHROPIC_MODEL_ID,
    );
    setCustomBaseUrl(config.provider === "custom" ? config.baseUrl : "");
    setCustomModelId(config.provider === "custom" ? config.modelId : "");
    setShowKey(false);
    setSaveState("saved");
  }, [config, projectClaudeAvailable]);

  return {
    accessMode,
    setAccessMode,
    byokProvider,
    setByokProvider,
    apiKey,
    setApiKey,
    reasoningEffort,
    setReasoningEffort,
    kimiModelId,
    setKimiModelId,
    anthropicModelId,
    setAnthropicModelId,
    customBaseUrl,
    setCustomBaseUrl,
    customModelId,
    setCustomModelId,
    showKey,
    setShowKey,
    saveState,
    draftResult,
    resetDraft,
  };
}

export type ModelSettingsDraft = ReturnType<typeof useModelSettingsDraft>;
