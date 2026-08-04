/**
 * File: app/page.tsx
 * Purpose: Compose the session-aware, responsive AI agent dashboard.
 * Problem solved: Coordinates chat, event inspection, model selection, and isolated desktops in one workspace.
 */
"use client";

import type { UIMessage } from "ai";
import { Bot, Monitor, Plus, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatWorkspace } from "@/components/dashboard/chat-workspace";
import {
  CreateDesktopDialog,
  DeleteDesktopDialog,
  RenameDesktopDialog,
} from "@/components/dashboard/desktop-dialogs";
import { MobileDesktopSwitcher } from "@/components/dashboard/mobile-desktop-switcher";
import {
  OnboardingTutorial,
  TUTORIAL_STORAGE_KEY,
} from "@/components/dashboard/onboarding-tutorial";
import { SessionSidebar } from "@/components/dashboard/session-sidebar";
import { ToolInspector } from "@/components/dashboard/tool-inspector";
import {
  VncViewer,
  type VncDisplayMode,
  type VncViewerState,
} from "@/components/dashboard/vnc-viewer";
import { DashboardSettings } from "@/components/model-settings";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  DEFAULT_MODEL_CONFIG,
  MODEL_SETTINGS_STORAGE_KEY,
  parseStoredModelConfig,
  type ClientModelConfig,
} from "@/lib/ai/model-config";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  createEmptyConversation,
  createEmptySession,
  loadSessions,
  persistSessions,
} from "@/lib/dashboard/session-storage";
import type {
  AgentEvent,
  AgentStatus,
  ChatSession,
  QueuedPrompt,
} from "@/lib/dashboard/types";
import { checkDesktopHealth, getDesktopURL } from "@/lib/sandbox/utils";
import { cn } from "@/lib/utils";

function modelEndpointSignature(config: ClientModelConfig) {
  if (config.provider === "kimi") {
    return `${config.provider}:${config.modelId}`;
  }
  if (config.provider === "custom") {
    return `${config.provider}:${config.baseUrl}:${config.modelId}`;
  }
  return config.provider;
}

function firstUserMessageTitle(messages: UIMessage[]) {
  const message = messages.find((item) => item.role === "user");
  if (!message) return null;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  if (!text) return null;
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [vncDisplayMode, setVncDisplayMode] =
    useState<VncDisplayMode>("embedded");
  const [isCreateDesktopOpen, setIsCreateDesktopOpen] = useState(false);
  const [deleteDesktopId, setDeleteDesktopId] = useState<string | null>(null);
  const [renameDesktopId, setRenameDesktopId] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<ClientModelConfig>(
    DEFAULT_MODEL_CONFIG,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const isDesktop = useDesktopLayout();
  const sessionsRef = useRef(sessions);
  const streamUrlsRef = useRef(streamUrls);
  const activeSessionIdRef = useRef(activeSessionId);
  const connectingRef = useRef(new Set<string>());
  const verifyingRef = useRef(new Set<string>());
  const viewerReadyRef = useRef(new Set<string>());

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    streamUrlsRef.current = streamUrls;
  }, [streamUrls]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const loadedSessions = loadSessions();
    const hasStoredSessionSnapshot =
      localStorage.getItem(SESSION_STORAGE_KEY) !== null;
    const nextSessions =
      loadedSessions.length > 0 || hasStoredSessionSnapshot
        ? loadedSessions
        : [createEmptySession("Desktop 1")];
    const storedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    const nextActiveId =
      nextSessions.length === 0
        ? null
        : nextSessions.some((session) => session.id === storedActiveId)
          ? storedActiveId
          : nextSessions[0].id;

    setSessions(nextSessions);
    activeSessionIdRef.current = nextActiveId;
    setActiveSessionId(nextActiveId);

    try {
      const storedModel = sessionStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
      if (storedModel) {
        const parsed = parseStoredModelConfig(JSON.parse(storedModel));
        if (parsed) setModelConfig(parsed);
      }
    } catch {
      sessionStorage.removeItem(MODEL_SETTINGS_STORAGE_KEY);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    let idleCallback: number | null = null;
    const timeout = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleCallback = window.requestIdleCallback(
          () => persistSessions(sessions),
          { timeout: 1200 },
        );
        return;
      }
      persistSessions(sessions);
    }, 700);
    return () => {
      window.clearTimeout(timeout);
      if (idleCallback !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallback);
      }
    };
  }, [isHydrated, sessions]);

  useEffect(() => {
    if (!isHydrated) return;
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  }, [activeSessionId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === "complete") return;
    const frame = window.requestAnimationFrame(() => setIsTutorialOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isHydrated]);

  const closeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "complete");
    setIsTutorialOpen(false);
  }, []);

  const replayTutorial = useCallback(() => {
    setIsTutorialOpen(true);
  }, []);

  const connectDesktop = useCallback(async (sessionId: string) => {
    if (
      connectingRef.current.has(sessionId) ||
      verifyingRef.current.has(sessionId)
    ) {
      return;
    }
    const session = sessionsRef.current.find((item) => item.id === sessionId);
    if (!session) return;

    connectingRef.current.add(sessionId);
    setSessions((previous) =>
      previous.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              connectionStatus: session.sandboxId ? "checking" : "creating",
            }
          : item,
      ),
    );

    try {
      const desktop = await getDesktopURL(session.sandboxId ?? undefined);
      setStreamUrls((previous) => ({
        ...previous,
        [sessionId]: desktop.streamUrl,
      }));
      viewerReadyRef.current.delete(sessionId);
      setSessions((previous) =>
        previous.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                sandboxId: desktop.id,
                generation:
                  item.sandboxId && item.sandboxId !== desktop.id
                    ? item.generation + 1
                    : item.generation,
                connectionStatus: "checking",
              }
            : item,
        ),
      );
    } catch {
      setSessions((previous) =>
        previous.map((item) =>
          item.id === sessionId
            ? { ...item, connectionStatus: "error" }
            : item,
        ),
      );
      toast.error("Failed to initialize the desktop", {
        description:
          "The Vercel Sandbox API or noVNC runtime could not be reached. Use Reconnect to try again.",
      });
    } finally {
      connectingRef.current.delete(sessionId);
    }
  }, []);

  const verifyDesktop = useCallback(
    async (sessionId: string, showChecking: boolean) => {
      if (
        connectingRef.current.has(sessionId) ||
        verifyingRef.current.has(sessionId)
      ) {
        return;
      }
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      if (!session?.sandboxId) return;
      const sandboxId = session.sandboxId;
      verifyingRef.current.add(sessionId);

      if (showChecking) {
        setSessions((previous) =>
          previous.map((item) =>
            item.id === sessionId && item.sandboxId === sandboxId
              ? { ...item, connectionStatus: "checking" }
              : item,
          ),
        );
      }

      try {
        const isHealthy = await checkDesktopHealth(sandboxId);
        const viewerIsConfirmed =
          activeSessionIdRef.current !== sessionId ||
          viewerReadyRef.current.has(sessionId);
        setSessions((previous) =>
          previous.map((item) =>
            item.id === sessionId && item.sandboxId === sandboxId
              ? {
                  ...item,
                  connectionStatus: isHealthy
                    ? viewerIsConfirmed
                      ? "ready"
                      : item.connectionStatus === "reconnecting"
                        ? "reconnecting"
                        : "checking"
                    : "offline",
                }
              : item,
          ),
        );

        if (!isHealthy) {
          setStreamUrls((previous) => {
            if (!(sessionId in previous)) return previous;
            const next = { ...previous };
            delete next[sessionId];
            return next;
          });
        }
      } catch {
        setSessions((previous) =>
          previous.map((item) =>
            item.id === sessionId && item.sandboxId === sandboxId
              ? { ...item, connectionStatus: "offline" }
              : item,
          ),
        );
        setStreamUrls((previous) => {
          if (!(sessionId in previous)) return previous;
          const next = { ...previous };
          delete next[sessionId];
          return next;
        });
      } finally {
        verifyingRef.current.delete(sessionId);
      }
    },
    [],
  );

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

  useEffect(() => {
    if (!isHydrated || !activeSession) return;
    if (
      !streamUrls[activeSession.id] &&
      (activeSession.connectionStatus === "uninitialized" ||
        activeSession.connectionStatus === "offline")
    ) {
      void connectDesktop(activeSession.id);
    }
  }, [activeSession, connectDesktop, isHydrated, streamUrls]);

  useEffect(() => {
    if (!isHydrated) return;

    const verifyKnownDesktops = () => {
      for (const session of sessionsRef.current) {
        if (
          !session.sandboxId ||
          session.connectionStatus === "creating" ||
          connectingRef.current.has(session.id)
        ) {
          continue;
        }
        void verifyDesktop(session.id, false);
      }
    };
    const verifyWhenVisible = () => {
      if (document.visibilityState === "visible") verifyKnownDesktops();
    };

    const interval = window.setInterval(verifyKnownDesktops, 10_000);
    window.addEventListener("focus", verifyKnownDesktops);
    document.addEventListener("visibilitychange", verifyWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", verifyKnownDesktops);
      document.removeEventListener("visibilitychange", verifyWhenVisible);
    };
  }, [isHydrated, verifyDesktop]);

  useEffect(() => {
    const killAllDesktops = () => {
      persistSessions(sessionsRef.current);
      for (const session of sessionsRef.current) {
        if (!session.sandboxId) continue;
        navigator.sendBeacon(
          `/api/kill-desktop?sandboxId=${encodeURIComponent(session.sandboxId)}`,
        );
      }
    };
    window.addEventListener("pagehide", killAllDesktops);
    return () => window.removeEventListener("pagehide", killAllDesktops);
  }, []);

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
    [agentStatus, verifyDesktop],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
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
        void fetch(
          `/api/kill-desktop?sandboxId=${encodeURIComponent(session.sandboxId)}`,
          { method: "POST" },
        );
      }

      const remaining = currentSessions.filter((item) => item.id !== sessionId);
      setSessions(remaining);
      setStreamUrls((previous) => {
        const next = { ...previous };
        delete next[sessionId];
        return next;
      });

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
    [agentStatus],
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
      events: AgentEvent[],
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

  const refreshActiveDesktop = useCallback(() => {
    if (!activeSessionIdRef.current) return;
    if (verifyingRef.current.has(activeSessionIdRef.current)) return;
    viewerReadyRef.current.delete(activeSessionIdRef.current);
    setStreamUrls((previous) => {
      const next = { ...previous };
      delete next[activeSessionIdRef.current ?? ""];
      return next;
    });
    void connectDesktop(activeSessionIdRef.current);
  }, [connectDesktop]);

  const handleViewerStateChange = useCallback(
    (sessionId: string, state: VncViewerState) => {
      if (sessionId !== activeSessionIdRef.current) return;
      if (state === "ready") {
        viewerReadyRef.current.add(sessionId);
        void verifyDesktop(sessionId, false);
        return;
      }

      viewerReadyRef.current.delete(sessionId);
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                connectionStatus:
                  state === "offline"
                    ? "offline"
                    : state === "reconnecting"
                      ? "reconnecting"
                      : "checking",
              }
            : session,
        ),
      );

      if (state === "offline") {
        setStreamUrls((previous) => {
          if (!(sessionId in previous)) return previous;
          const next = { ...previous };
          delete next[sessionId];
          return next;
        });
      }
    },
    [verifyDesktop],
  );

  const activeEvent = useMemo(() => {
    if (!activeConversation) return null;
    return (
      activeConversation.events.find((event) => event.id === selectedEventId) ??
      activeConversation.events.at(-1) ??
      null
    );
  }, [activeConversation, selectedEventId]);

  const activityEvent = useMemo(
    () =>
      activeConversation?.events.findLast(
        (event) => event.status === "pending",
      ) ??
      activeConversation?.events.at(-1) ??
      null,
    [activeConversation?.events],
  );

  const deleteTargetSession = useMemo(
    () =>
      sessions.find((session) => session.id === deleteDesktopId) ?? null,
    [deleteDesktopId, sessions],
  );

  const renameTargetSession = useMemo(
    () =>
      sessions.find((session) => session.id === renameDesktopId) ?? null,
    [renameDesktopId, sessions],
  );

  const settingsControl = useMemo(
    () => (
      <DashboardSettings
        config={modelConfig}
        modelDisabled={agentStatus !== "idle"}
        trigger="rail"
        onConfigChange={updateModelConfig}
        onReplayTutorial={replayTutorial}
      />
    ),
    [agentStatus, modelConfig, replayTutorial, updateModelConfig],
  );

  if (!isHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-zinc-400">
        <div className="flex items-center gap-2 text-xs">
          <Radio className="size-4 animate-pulse text-violet-400" />
          Restoring agent workspace…
        </div>
      </div>
    );
  }

  const appHeader = (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-100 bg-surface px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="size-3.5" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight min-[390px]:inline">
          Agent Desk
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:block">
          <StatusIndicator status={agentStatus} />
        </div>

        {!isDesktop ? (
          <DashboardSettings
            config={modelConfig}
            modelDisabled={agentStatus !== "idle"}
            trigger="icon"
            onConfigChange={updateModelConfig}
            onReplayTutorial={replayTutorial}
          />
        ) : null}
      </div>
    </header>
  );

  const desktopDialogs = (
    <>
      <CreateDesktopDialog
        open={isCreateDesktopOpen}
        existingNames={sessions.map((session) => session.title)}
        onCancel={closeCreateSession}
        onCreate={createSession}
      />
      <DeleteDesktopDialog
        session={deleteTargetSession}
        onCancel={closeDeleteSession}
        onConfirm={deleteSession}
      />
      <RenameDesktopDialog
        session={renameTargetSession}
        existingNames={sessions
          .filter((session) => session.id !== renameDesktopId)
          .map((session) => session.title)}
        onCancel={closeRenameSession}
        onRename={renameSession}
      />
    </>
  );

  const tutorialOverlay = (
    <OnboardingTutorial
      open={isTutorialOpen}
      onComplete={closeTutorial}
      onSkip={closeTutorial}
    />
  );

  if (!activeSession || !activeConversation) {
    const emptyState = (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <Monitor className="size-4.5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-zinc-900">
          No desktops yet
        </h2>
        <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-500">
          Create an isolated desktop when you are ready to start a new agent
          workspace.
        </p>
        <button
          type="button"
          onClick={requestCreateSession}
          className="mt-4 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-85"
        >
          <Plus className="size-3.5" />
          Create desktop
        </button>
      </section>
    );

    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-surface text-zinc-900">
        {appHeader}
        <main className="flex min-h-0 flex-1">
          {isDesktop ? (
            <>
              <SessionSidebar
                sessions={sessions}
                activeSessionId={null}
                disabled={false}
                settingsControl={settingsControl}
                onCreate={requestCreateSession}
                onSelect={selectSession}
                onRequestDelete={requestDeleteSession}
                onRequestRename={requestRenameSession}
                onReorder={reorderSessions}
                onTogglePin={togglePinSession}
              />
              {emptyState}
            </>
          ) : (
            emptyState
          )}
        </main>
        {desktopDialogs}
        {tutorialOverlay}
      </div>
    );
  }

  const chatWorkspace = (
    <ChatWorkspace
      key={`${activeSession.id}-${activeConversation.id}-${modelEndpointSignature(modelConfig)}`}
      sessionId={activeSession.id}
      conversationId={activeConversation.id}
      conversationRevision={activeConversation.revision}
      conversations={activeSession.conversations}
      sandboxId={activeSession.sandboxId}
      initialMessages={activeConversation.messages}
      initialEvents={activeConversation.events}
      initialQueuedPrompts={activeConversation.queuedPrompts}
      modelConfig={modelConfig}
      connectionReady={activeSession.connectionStatus === "ready"}
      connectionStatus={activeSession.connectionStatus}
      selectedEventId={selectedEventId}
      onCreateConversation={createConversation}
      onSelectConversation={selectConversation}
      onSelectEvent={setSelectedEventId}
      onConversationChange={updateConversation}
      onQueueChange={updatePromptQueue}
      onStatusChange={setAgentStatus}
    />
  );

  const vncViewer = (
    <VncViewer
      sessionId={activeSession.id}
      sessionTitle={activeSession.title}
      streamUrl={streamUrls[activeSession.id] ?? null}
      sandboxId={activeSession.sandboxId}
      generation={activeSession.generation}
      connectionStatus={activeSession.connectionStatus}
      agentStatus={agentStatus}
      activityEvent={activityEvent}
      displayMode={vncDisplayMode}
      showHeader={isDesktop}
      onDisplayModeChange={setVncDisplayMode}
      onViewerStateChange={handleViewerStateChange}
      onRefresh={refreshActiveDesktop}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-zinc-900">
      {appHeader}

      {isDesktop ? (
        <main className="min-h-0 flex-1">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={47} minSize={34} maxSize={66}>
              <div className="flex h-full min-w-0">
                <SessionSidebar
                  sessions={sessions}
                  activeSessionId={activeSession.id}
                  disabled={agentStatus !== "idle"}
                  settingsControl={settingsControl}
                  onCreate={requestCreateSession}
                  onSelect={selectSession}
                  onRequestDelete={requestDeleteSession}
                  onRequestRename={requestRenameSession}
                  onReorder={reorderSessions}
                  onTogglePin={togglePinSession}
                />
                {chatWorkspace}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-zinc-100" />

            <ResizablePanel defaultSize={53} minSize={34}>
              <div className="flex h-full min-w-0 flex-col">
                {vncViewer}
                <ToolInspector
                  event={activeEvent}
                  fill={vncDisplayMode !== "embedded"}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      ) : (
        <main
          className={cn(
            "grid min-h-0 flex-1 bg-zinc-100",
            vncDisplayMode === "embedded"
              ? "grid-rows-[46%_54%]"
              : "grid-rows-[40px_minmax(0,1fr)]",
          )}
        >
          <section
            className={cn(
              "flex min-h-0 flex-col border-b border-zinc-200",
              vncDisplayMode === "embedded"
                ? "overflow-hidden"
                : "overflow-visible",
            )}
          >
            <MobileDesktopSwitcher
              sessions={sessions}
              activeSessionId={activeSession.id}
              disabled={agentStatus !== "idle"}
              displayMode={vncDisplayMode}
              onCreate={requestCreateSession}
              onDisplayModeChange={setVncDisplayMode}
              onRefresh={refreshActiveDesktop}
              onSelect={selectSession}
            />
            <div className="flex min-h-0 flex-1">{vncViewer}</div>
          </section>
          <section className="flex min-h-0 overflow-hidden bg-surface">
            {chatWorkspace}
          </section>
        </main>
      )}
      {desktopDialogs}
      {tutorialOverlay}
    </div>
  );
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium capitalize text-zinc-600">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "idle" && "bg-emerald-500",
          status === "thinking" && "animate-pulse bg-violet-500",
          status === "executing" && "animate-pulse bg-amber-500",
        )}
      />
      {status}
    </span>
  );
}
