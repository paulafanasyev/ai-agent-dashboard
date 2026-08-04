/**
 * File: lib/dashboard/use-dashboard-model-config.ts
 * Purpose: Own model capability discovery, API profile CRUD, and per-Conversation selection.
 * Problem solved: Keeps multiple tab-scoped credentials isolated while each Conversation chooses its model profile.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getModelCapabilities } from "@/lib/ai/capabilities";
import {
  DEFAULT_MODEL_CONFIG,
  PROJECT_CLAUDE_CONFIG_ID,
  type ApiConfigProfile,
  type ApiConfigState,
  type SelectableApiConfig,
} from "@/lib/ai/model-config";
import { modelEndpointSignature } from "@/lib/dashboard/presentation";
import type { ChatConversation, ChatSession } from "@/lib/dashboard/types";

interface DashboardModelConfigOptions {
  apiConfigState: ApiConfigState;
  setApiConfigState: React.Dispatch<React.SetStateAction<ApiConfigState>>;
  activeConversation: ChatConversation | null;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionIdRef: { current: string | null };
}

/** Resolves profile CRUD and the effective model without ever persisting credentials in durable history. */
export function useDashboardModelConfig({
  apiConfigState,
  setApiConfigState,
  activeConversation,
  setSessions,
  activeSessionIdRef,
}: DashboardModelConfigOptions) {
  const [projectClaudeAvailable, setProjectClaudeAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getModelCapabilities()
      .then((capabilities) => {
        if (active) setProjectClaudeAvailable(capabilities.projectClaudeAvailable);
      })
      .catch(() => {
        if (active) setProjectClaudeAvailable(false);
      });
    return () => void (active = false);
  }, []);

  const selectableApiConfigs = useMemo<SelectableApiConfig[]>(() => {
    const profiles = apiConfigState.profiles.map((profile) => ({
      ...profile,
      builtIn: false,
    }));
    return projectClaudeAvailable
      ? [
          {
            id: PROJECT_CLAUDE_CONFIG_ID,
            name: "Project Claude",
            config: DEFAULT_MODEL_CONFIG,
            builtIn: true,
          },
          ...profiles,
        ]
      : profiles;
  }, [apiConfigState.profiles, projectClaudeAvailable]);

  const fallbackConfigId = useMemo(() => {
    if (
      apiConfigState.defaultConfigId &&
      selectableApiConfigs.some(
        (profile) => profile.id === apiConfigState.defaultConfigId,
      )
    ) {
      return apiConfigState.defaultConfigId;
    }
    return selectableApiConfigs[0]?.id ?? null;
  }, [apiConfigState.defaultConfigId, selectableApiConfigs]);

  const selectedApiConfigId =
    activeConversation?.apiConfigId &&
    selectableApiConfigs.some(
      (profile) => profile.id === activeConversation.apiConfigId,
    )
      ? activeConversation.apiConfigId
      : fallbackConfigId;
  const selectedApiConfig =
    selectableApiConfigs.find(
      (profile) => profile.id === selectedApiConfigId,
    ) ?? null;
  const modelConfig = selectedApiConfig?.config ?? DEFAULT_MODEL_CONFIG;

  const createApiConfig = useCallback(
    (profile: ApiConfigProfile) => {
      setApiConfigState((previous) => ({
        profiles: [...previous.profiles, profile],
        defaultConfigId: previous.defaultConfigId ?? profile.id,
      }));
    },
    [setApiConfigState],
  );

  const updateApiConfig = useCallback(
    (profile: ApiConfigProfile) => {
      setApiConfigState((previous) => ({
        ...previous,
        profiles: previous.profiles.map((candidate) =>
          candidate.id === profile.id ? profile : candidate,
        ),
      }));
    },
    [setApiConfigState],
  );

  const deleteApiConfig = useCallback(
    (profileId: string) => {
      setApiConfigState((previous) => {
        const profiles = previous.profiles.filter(
          (profile) => profile.id !== profileId,
        );
        return {
          profiles,
          defaultConfigId:
            previous.defaultConfigId === profileId
              ? profiles[0]?.id ??
                (projectClaudeAvailable ? PROJECT_CLAUDE_CONFIG_ID : null)
              : previous.defaultConfigId,
        };
      });
      setSessions((previous) =>
        previous.map((session) => ({
          ...session,
          conversations: session.conversations.map((conversation) =>
            conversation.apiConfigId === profileId
              ? {
                  ...conversation,
                  apiConfigId: null,
                  revision: conversation.revision + 1,
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
          updatedAt: Date.now(),
        })),
      );
    },
    [projectClaudeAvailable, setApiConfigState, setSessions],
  );

  const setDefaultApiConfig = useCallback(
    (profileId: string) => {
      if (!selectableApiConfigs.some((profile) => profile.id === profileId)) return;
      setApiConfigState((previous) => ({
        ...previous,
        defaultConfigId: profileId,
      }));
    },
    [selectableApiConfigs, setApiConfigState],
  );

  const selectApiConfig = useCallback(
    (profileId: string) => {
      if (
        !activeSessionIdRef.current ||
        !selectableApiConfigs.some((profile) => profile.id === profileId)
      ) {
        return;
      }
      const sessionId = activeSessionIdRef.current;
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                conversations: session.conversations.map((conversation) =>
                  conversation.id === session.activeConversationId &&
                  conversation.apiConfigId !== profileId
                    ? {
                        ...conversation,
                        apiConfigId: profileId,
                        revision: conversation.revision + 1,
                        updatedAt: Date.now(),
                      }
                    : conversation,
                ),
                updatedAt: Date.now(),
              }
            : session,
        ),
      );
    },
    [activeSessionIdRef, selectableApiConfigs, setSessions],
  );

  return {
    projectClaudeAvailable,
    modelConfig,
    modelConfigured: selectedApiConfig !== null,
    modelSignature: `${selectedApiConfigId ?? "unconfigured"}:${modelEndpointSignature(modelConfig)}`,
    selectableApiConfigs,
    selectedApiConfigId,
    createApiConfig,
    updateApiConfig,
    deleteApiConfig,
    setDefaultApiConfig,
    selectApiConfig,
  };
}
