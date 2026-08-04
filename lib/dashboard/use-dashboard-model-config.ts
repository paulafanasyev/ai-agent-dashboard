/**
 * File: lib/dashboard/use-dashboard-model-config.ts
 * Purpose: Own model capability discovery and tab-scoped model selection changes.
 * Problem solved: Applies provider changes safely without mixing credentials into page composition or durable history.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getModelCapabilities } from "@/lib/ai/capabilities";
import {
  MODEL_SETTINGS_STORAGE_KEY,
  type ClientModelConfig,
} from "@/lib/ai/model-config";
import { modelEndpointSignature } from "@/lib/dashboard/presentation";
import type { ChatSession } from "@/lib/dashboard/types";

interface DashboardModelConfigOptions {
  modelConfig: ClientModelConfig;
  setModelConfig: React.Dispatch<React.SetStateAction<ClientModelConfig>>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionIdRef: { current: string | null };
  setSelectedEventId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Owns capability discovery and tab-scoped provider changes. Changing the effective endpoint
 * clears only the active Conversation because messages from different models must not be mixed.
 */
export function useDashboardModelConfig({
  modelConfig,
  setModelConfig,
  setSessions,
  activeSessionIdRef,
  setSelectedEventId,
}: DashboardModelConfigOptions) {
  const [projectClaudeAvailable, setProjectClaudeAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getModelCapabilities()
      .then((capabilities) => {
        if (active) {
          setProjectClaudeAvailable(capabilities.projectClaudeAvailable);
        }
      })
      .catch(() => {
        if (active) setProjectClaudeAvailable(false);
      });
    return () => void (active = false);
  }, []);

  const updateModelConfig = useCallback(
    (nextConfig: ClientModelConfig) => {
      if (JSON.stringify(nextConfig) === JSON.stringify(modelConfig)) return;
      const changedModel =
        modelEndpointSignature(nextConfig) !==
        modelEndpointSignature(modelConfig);

      if (nextConfig.provider !== "anthropic") {
        sessionStorage.setItem(
          MODEL_SETTINGS_STORAGE_KEY,
          JSON.stringify(nextConfig),
        );
      } else {
        sessionStorage.removeItem(MODEL_SETTINGS_STORAGE_KEY);
      }

      setModelConfig(nextConfig);
      if (changedModel && activeSessionIdRef.current) {
        const sessionId = activeSessionIdRef.current;
        setSessions((previous) =>
          previous.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              conversations: session.conversations.map((conversation) =>
                conversation.id === session.activeConversationId
                  ? {
                      ...conversation,
                      messages: [],
                      events: [],
                      queuedPrompts: [],
                      revision: conversation.revision + 1,
                      updatedAt: Date.now(),
                    }
                  : conversation,
              ),
              updatedAt: Date.now(),
            };
          }),
        );
        setSelectedEventId(null);
      }
    },
    [
      activeSessionIdRef,
      modelConfig,
      setModelConfig,
      setSelectedEventId,
      setSessions,
    ],
  );

  const modelSignature = useMemo(
    () => modelEndpointSignature(modelConfig),
    [modelConfig],
  );

  return {
    projectClaudeAvailable,
    modelConfigured:
      modelConfig.provider !== "anthropic" || projectClaudeAvailable,
    modelSignature,
    updateModelConfig,
  };
}
