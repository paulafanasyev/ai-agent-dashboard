/**
 * File: app/page.tsx
 * Purpose: Compose the session-aware, responsive AI agent dashboard.
 * Problem solved: Coordinates chat, event inspection, model selection, and isolated desktops in one workspace.
 */
/* eslint-disable react-hooks/exhaustive-deps -- React setters and refs returned by useDashboardPersistence are stable. */
"use client";

import type { UIMessage } from "ai";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DesktopDialogStack } from "@/components/dashboard/desktop-dialogs";
import { OnboardingTutorial } from "@/components/dashboard/onboarding-tutorial";
import type { VncDisplayMode } from "@/components/dashboard/vnc-viewer";
import { DashboardSettings } from "@/components/model-settings";
import {
  MODEL_SETTINGS_STORAGE_KEY,
  type ClientModelConfig,
} from "@/lib/ai/model-config";
import { mergeEventTimeline } from "@/lib/dashboard/events";
import {
  firstUserMessageTitle,
  modelEndpointSignature,
} from "@/lib/dashboard/presentation";
import {
  createEmptyConversation,
  createEmptySession,
} from "@/lib/dashboard/session-storage";
import type {
  AgentStatus,
  QueuedPrompt,
  ToolEvent,
} from "@/lib/dashboard/types";
import { useDashboardPersistence } from "@/lib/dashboard/use-dashboard-persistence";
import { useDashboardTutorial } from "@/lib/dashboard/use-dashboard-tutorial";
import { useDesktopLayout } from "@/lib/dashboard/use-desktop-layout";
import { useDesktopRuntime } from "@/lib/dashboard/use-desktop-runtime";

export default function DashboardPage() {
  const {
    sessions,
    setSessions,
    sessionsRef,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    modelConfig,
    setModelConfig,
    isHydrated,
    clearLocalDashboardData,
  } = useDashboardPersistence();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [vncDisplayMode, setVncDisplayMode] =
    useState<VncDisplayMode>("embedded");
  const [isCreateDesktopOpen, setIsCreateDesktopOpen] = useState(false);
  const [deleteDesktopId, setDeleteDesktopId] = useState<string | null>(null);
  const [renameDesktopId, setRenameDesktopId] = useState<string | null>(null);
  const isDesktop = useDesktopLayout();
  const { isTutorialOpen, closeTutorial, replayTutorial } =
    useDashboardTutorial(isHydrated);

  const {
    streamUrls,
    streamUrlsRef,
    viewerReadyRef,
    verifyDesktop,
    removeStreamUrl,
    destroyDesktop,
    refreshActiveDesktop,
    handleViewerStateChange,
  } = useDesktopRuntime({
    sessions,
    setSessions,
    activeSessionId,
    isHydrated,
  });

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeConversation = useMemo(
    () =>
      activeSession?.conversations.find(
        (conversation) =>
          conversation.id === activeSession.activeConversationId,
      ) ?? null,
    [activeSession],
  );


  const createSession = useCallback((name: string) => {
    if (agentStatus !== "idle") return;
    const session = createEmptySession(name);
    setSessions((previous) => [...previous, session]);
    activeSessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setSelectedEventId(null);
    setAgentStatus("idle");
    setIsCreateDesktopOpen(false);
    toast.success(`${name} created`);
  }, [agentStatus]);

  const requestCreateSession = useCallback(() => {
    if (agentStatus !== "idle") return;
    setIsCreateDesktopOpen(true);
  }, [agentStatus]);

  const closeCreateSession = useCallback(() => {
    setIsCreateDesktopOpen(false);
  }, []);

  const createConversation = useCallback(() => {
    if (agentStatus !== "idle" || !activeSessionIdRef.current) return;
    const conversation = createEmptyConversation();
    const sessionId = activeSessionIdRef.current;
    setSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              activeConversationId: conversation.id,
              conversations: [...session.conversations, conversation],
              updatedAt: Date.now(),
            }
          : session,
      ),
    );
    setSelectedEventId(null);
    toast.success("New conversation opened in the current desktop");
  }, [agentStatus]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      if (agentStatus !== "idle" || !activeSessionIdRef.current) {
        toast.info("Stop the active run before switching conversations.");
        return;
      }
      const sessionId = activeSessionIdRef.current;
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      const conversation = session?.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) return;
      setSessions((previous) =>
        previous.map((item) =>
          item.id === sessionId
            ? { ...item, activeConversationId: conversationId }
            : item,
        ),
      );
      setSelectedEventId(conversation.events.at(-1)?.id ?? null);
    },
    [agentStatus],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionIdRef.current) return;
      if (agentStatus !== "idle" && sessionId !== activeSessionIdRef.current) {
        toast.info("Stop the active run before switching sessions.");
        return;
      }
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      const conversation = session?.conversations.find(
        (item) => item.id === session.activeConversationId,
      );
      viewerReadyRef.current.delete(sessionId);
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);
      setSelectedEventId(conversation?.events.at(-1)?.id ?? null);
      setAgentStatus("idle");
      if (session?.sandboxId && streamUrlsRef.current[sessionId]) {
        void verifyDesktop(sessionId, true);
      }
    },
    [agentStatus, streamUrlsRef, verifyDesktop, viewerReadyRef],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (
        agentStatus !== "idle" &&
        sessionId === activeSessionIdRef.current
      ) {
        toast.info("Stop the active run before deleting this session.");
        return;
      }

      const currentSessions = sessionsRef.current;
      const session = currentSessions.find((item) => item.id === sessionId);
      if (session?.sandboxId) {
        await destroyDesktop(sessionId, session.sandboxId);
      }

      const remaining = currentSessions.filter((item) => item.id !== sessionId);
      setSessions(remaining);
      removeStreamUrl(sessionId);

      if (sessionId === activeSessionIdRef.current) {
        if (remaining.length === 0) {
          activeSessionIdRef.current = null;
          setActiveSessionId(null);
          setSelectedEventId(null);
          setAgentStatus("idle");
          setDeleteDesktopId(null);
          toast.success("Desktop deleted");
          return;
        }
        const removedIndex = currentSessions.findIndex(
          (item) => item.id === sessionId,
        );
        const nextSession =
          remaining[Math.min(removedIndex, remaining.length - 1)];
        const nextConversation = nextSession.conversations.find(
          (conversation) =>
            conversation.id === nextSession.activeConversationId,
        );
        activeSessionIdRef.current = nextSession.id;
        setActiveSessionId(nextSession.id);
        setSelectedEventId(nextConversation?.events.at(-1)?.id ?? null);
      }
      setDeleteDesktopId(null);
      toast.success("Desktop deleted");
    },
    [agentStatus, destroyDesktop, removeStreamUrl],
  );

  const requestDeleteSession = useCallback(
    (sessionId: string) => {
      if (agentStatus !== "idle") {
        toast.info("Stop the active run before deleting a desktop.");
        return;
      }
      if (!sessionsRef.current.some((session) => session.id === sessionId)) {
        return;
      }
      setDeleteDesktopId(sessionId);
    },
    [agentStatus],
  );

  const closeDeleteSession = useCallback(() => {
    setDeleteDesktopId(null);
  }, []);

  const requestRenameSession = useCallback(
    (sessionId: string) => {
      if (agentStatus !== "idle") {
        toast.info("Stop the active run before renaming a desktop.");
        return;
      }
      if (!sessionsRef.current.some((session) => session.id === sessionId)) {
        return;
      }
      setRenameDesktopId(sessionId);
    },
    [agentStatus],
  );

  const closeRenameSession = useCallback(() => {
    setRenameDesktopId(null);
  }, []);

  const renameSession = useCallback(
    (sessionId: string, name: string) => {
      if (agentStatus !== "idle") return;
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? { ...session, title: name, updatedAt: Date.now() }
            : session,
        ),
      );
      setRenameDesktopId(null);
      toast.success(`Desktop renamed to ${name}`);
    },
    [agentStatus],
  );

  const togglePinSession = useCallback(
    (sessionId: string) => {
      if (agentStatus !== "idle") return;
      setSessions((previous) => {
        const session = previous.find((item) => item.id === sessionId);
        if (!session) return previous;
        const pinned = !session.pinned;
        const updated = {
          ...session,
          pinned,
          updatedAt: Date.now(),
        };
        const remaining = previous.filter((item) => item.id !== sessionId);
        const firstUnpinnedIndex = remaining.findIndex((item) => !item.pinned);
        const insertionIndex =
          firstUnpinnedIndex < 0 ? remaining.length : firstUnpinnedIndex;
        const next = [...remaining];
        next.splice(insertionIndex, 0, updated);
        return next;
      });
      const wasPinned = sessionsRef.current.find(
        (session) => session.id === sessionId,
      )?.pinned;
      toast.success(wasPinned ? "Desktop unpinned" : "Desktop pinned");
    },
    [agentStatus],
  );

  const reorderSessions = useCallback(
    (
      draggedSessionId: string,
      targetSessionId: string,
      position: "before" | "after",
    ) => {
      if (agentStatus !== "idle" || draggedSessionId === targetSessionId) return;
      setSessions((previous) => {
        const draggedIndex = previous.findIndex(
          (session) => session.id === draggedSessionId,
        );
        if (draggedIndex < 0) return previous;
        const next = [...previous];
        const [draggedSession] = next.splice(draggedIndex, 1);
        const targetIndex = next.findIndex(
          (session) => session.id === targetSessionId,
        );
        if (targetIndex < 0) return previous;
        const targetSession = next[targetIndex];
        next.splice(
          position === "after" ? targetIndex + 1 : targetIndex,
          0,
          draggedSession.pinned === targetSession.pinned
            ? draggedSession
            : {
                ...draggedSession,
                pinned: targetSession.pinned,
                updatedAt: Date.now(),
              },
        );
        return next;
      });
    },
    [agentStatus],
  );

  const updateConversation = useCallback(
    (
      sessionId: string,
      conversationId: string,
      messages: UIMessage[],
      events: ToolEvent[],
    ) => {
      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== sessionId) return session;
          return {
            ...session,
            conversations: session.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              const title =
                conversation.title === "New conversation"
                  ? firstUserMessageTitle(messages) ?? conversation.title
                  : conversation.title;
              return {
                ...conversation,
                title,
                messages,
                events,
                updatedAt: Date.now(),
              };
            }),
            updatedAt: Date.now(),
          };
        }),
      );
      if (
        sessionId === activeSessionIdRef.current &&
        sessionsRef.current.find((session) => session.id === sessionId)
          ?.activeConversationId === conversationId
      ) {
        setSelectedEventId((current) => {
          const latest = events.at(-1);
          const currentEvent = events.find((event) => event.id === current);
          if (!latest) return current;
          if (!current || (latest.status === "pending" && currentEvent?.status !== "pending")) {
            return latest.id;
          }
          return current;
        });
      }
    },
    [],
  );

  const updatePromptQueue = useCallback(
    (
      sessionId: string,
      conversationId: string,
      queuedPrompts: QueuedPrompt[],
    ) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                conversations: session.conversations.map((conversation) =>
                  conversation.id === conversationId
                    ? {
                        ...conversation,
                        queuedPrompts,
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
    [],
  );

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
    [modelConfig],
  );

  const clearAllData = useCallback(async () => {
    if (agentStatus !== "idle") {
      toast.info("Stop the active run before clearing cached data.");
      return;
    }

    const currentSessions = [...sessionsRef.current];
    await Promise.all(
      currentSessions.map(async (session) => {
        if (session.sandboxId) {
          await destroyDesktop(session.id, session.sandboxId);
        }
        removeStreamUrl(session.id);
      }),
    );

    viewerReadyRef.current.clear();
    clearLocalDashboardData();
    setSelectedEventId(null);
    setAgentStatus("idle");
    setVncDisplayMode("embedded");
    toast.success("All sessions, chats, and cached settings were deleted");
  }, [
    agentStatus,
    clearLocalDashboardData,
    destroyDesktop,
    removeStreamUrl,
    viewerReadyRef,
  ]);


  const activeEvents = useMemo(
    () =>
      activeSession && activeConversation
        ? mergeEventTimeline(
            activeConversation.events,
            activeSession.runtimeEvents,
          )
        : [],
    [activeConversation, activeSession],
  );

  const activeEvent = useMemo(() => {
    if (!activeConversation) return null;
    return (
      activeEvents.find((event) => event.id === selectedEventId) ??
      activeEvents.at(-1) ??
      null
    );
  }, [activeConversation, activeEvents, selectedEventId]);

  const activityEvent = useMemo(
    () =>
      activeConversation?.events.findLast(
        (event) => event.status === "pending",
      ) ??
      activeConversation?.events.at(-1) ??
      null,
    [activeConversation?.events],
  );

  const settingsControl = useMemo(
    () => (
      <DashboardSettings
        config={modelConfig}
        modelDisabled={agentStatus !== "idle"}
        trigger="rail"
        onConfigChange={updateModelConfig}
        onReplayTutorial={replayTutorial}
        onClearAllData={clearAllData}
      />
    ),
    [
      agentStatus,
      clearAllData,
      modelConfig,
      replayTutorial,
      updateModelConfig,
    ],
  );

  const dialogs = (
    <DesktopDialogStack
      sessions={sessions}
      createOpen={isCreateDesktopOpen}
      deleteSessionId={deleteDesktopId}
      renameSessionId={renameDesktopId}
      onCloseCreate={closeCreateSession}
      onCreate={createSession}
      onCloseDelete={closeDeleteSession}
      onDelete={deleteSession}
      onCloseRename={closeRenameSession}
      onRename={renameSession}
    />
  );

  const tutorial = (
    <OnboardingTutorial
      open={isTutorialOpen}
      onComplete={closeTutorial}
      onSkip={closeTutorial}
    />
  );

  const mobileSettings = (
    <DashboardSettings
      config={modelConfig}
      modelDisabled={agentStatus !== "idle"}
      trigger="icon"
      onConfigChange={updateModelConfig}
      onReplayTutorial={replayTutorial}
      onClearAllData={clearAllData}
    />
  );

  return (
    <DashboardShell
      isHydrated={isHydrated}
      isDesktop={isDesktop}
      sessions={sessions}
      activeSession={activeSession}
      activeConversation={activeConversation}
      streamUrls={streamUrls}
      selectedEventId={selectedEventId}
      activeEvent={activeEvent}
      activityEvent={activityEvent}
      agentStatus={agentStatus}
      modelConfig={modelConfig}
      vncDisplayMode={vncDisplayMode}
      settingsControl={settingsControl}
      dialogs={dialogs}
      tutorial={tutorial}
      mobileSettings={mobileSettings}
      modelSignature={modelEndpointSignature(modelConfig)}
      onCreateDesktop={requestCreateSession}
      onSelectSession={selectSession}
      onRequestDelete={requestDeleteSession}
      onRequestRename={requestRenameSession}
      onReorder={reorderSessions}
      onTogglePin={togglePinSession}
      onCreateConversation={createConversation}
      onSelectConversation={selectConversation}
      onSelectEvent={setSelectedEventId}
      onConversationChange={updateConversation}
      onQueueChange={updatePromptQueue}
      onStatusChange={setAgentStatus}
      onDisplayModeChange={setVncDisplayMode}
      onViewerStateChange={handleViewerStateChange}
      onRefreshDesktop={refreshActiveDesktop}
    />
  );
}
