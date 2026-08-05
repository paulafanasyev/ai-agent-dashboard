/**
 * File: lib/dashboard/use-dashboard-session-actions.ts
 * Purpose: Own desktop and conversation mutations independently from page composition.
 * Problem solved: Centralizes guarded create, select, rename, delete, pin, reorder, and update behavior.
 */
"use client";

import type { UIMessage } from "ai";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { firstUserMessageTitle } from "@/lib/dashboard/presentation";
import {
  createEmptyConversation,
  createEmptySession,
} from "@/lib/dashboard/session-storage";
import type {
  AgentStatus,
  ChatSession,
  QueuedPrompt,
  ToolEvent,
} from "@/lib/dashboard/types";

interface DashboardSessionActionsOptions {
  agentStatus: AgentStatus;
  setAgentStatus: React.Dispatch<React.SetStateAction<AgentStatus>>;
  setSelectedEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  sessionsRef: { current: ChatSession[] };
  activeSessionIdRef: { current: string | null };
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  streamUrlsRef: { current: Record<string, string> };
  verifyDesktop: (sessionId: string, showChecking: boolean) => Promise<void>;
  destroyDesktop: (sessionId: string, sandboxId: string) => Promise<void>;
  removeStreamUrl: (sessionId: string) => void;
}

/**
 * Exposes the guarded mutation API for Desktop Sessions and Conversations.
 * Mutations that could detach an active stream are rejected while the agent is running.
 */
export function useDashboardSessionActions({
  agentStatus,
  setAgentStatus,
  setSelectedEventId,
  setSessions,
  sessionsRef,
  activeSessionIdRef,
  setActiveSessionId,
  streamUrlsRef,
  verifyDesktop,
  destroyDesktop,
  removeStreamUrl,
}: DashboardSessionActionsOptions) {
  const [isCreateDesktopOpen, setIsCreateDesktopOpen] = useState(false);
  const [deleteDesktopId, setDeleteDesktopId] = useState<string | null>(null);
  const [renameDesktopId, setRenameDesktopId] = useState<string | null>(null);

  /** Adds and selects a local Desktop record; runtime allocation remains lazy in the runtime hook. */
  const createSession = useCallback(
    (name: string) => {
      if (agentStatus !== "idle") return;
      const session = createEmptySession(name);
      setSessions((previous) => [...previous, session]);
      activeSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setSelectedEventId(null);
      setAgentStatus("idle");
      setIsCreateDesktopOpen(false);
      toast.success(`${name} created`);
    },
    [
      activeSessionIdRef,
      agentStatus,
      setActiveSessionId,
      setAgentStatus,
      setSelectedEventId,
      setSessions,
    ],
  );

  const requestCreateSession = useCallback(() => {
    if (agentStatus !== "idle") return;
    setIsCreateDesktopOpen(true);
  }, [agentStatus]);

  const closeCreateSession = useCallback(() => {
    setIsCreateDesktopOpen(false);
  }, []);

  /** Adds an isolated Conversation while preserving the current Desktop and Sandbox identity. */
  const createConversation = useCallback(() => {
    if (agentStatus !== "idle" || !activeSessionIdRef.current) return;
    const sessionId = activeSessionIdRef.current;
    const currentSession = sessionsRef.current.find(
      (session) => session.id === sessionId,
    );
    const currentModelId =
      currentSession?.conversations.find(
        (conversation) =>
          conversation.id === currentSession.activeConversationId,
      )?.apiConfigId ?? null;
    const conversation = createEmptyConversation(currentModelId);
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
  }, [activeSessionIdRef, agentStatus, sessionsRef, setSelectedEventId, setSessions]);

  /** Switches chat history only when no active stream can be detached from its owner. */
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
    [
      activeSessionIdRef,
      agentStatus,
      sessionsRef,
      setSelectedEventId,
      setSessions,
    ],
  );

  /** Renames one Conversation without changing its messages, events, or active identity. */
  const renameConversation = useCallback(
    (conversationId: string, name: string) => {
      if (agentStatus !== "idle" || !activeSessionIdRef.current) {
        toast.info("Stop the active run before editing conversations.");
        return;
      }
      const sessionId = activeSessionIdRef.current;
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                conversations: session.conversations.map((conversation) =>
                  conversation.id === conversationId
                    ? { ...conversation, title: name, updatedAt: Date.now() }
                    : conversation,
                ),
                updatedAt: Date.now(),
              }
            : session,
        ),
      );
      toast.success(`Conversation renamed to ${name}`);
    },
    [activeSessionIdRef, agentStatus, setSessions],
  );

  /** Deletes one Conversation and selects a neighbor, preserving one empty Conversation minimum. */
  const deleteConversation = useCallback(
    (conversationId: string) => {
      if (agentStatus !== "idle" || !activeSessionIdRef.current) {
        toast.info("Stop the active run before deleting conversations.");
        return;
      }
      const sessionId = activeSessionIdRef.current;
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      const deletedIndex =
        session?.conversations.findIndex((item) => item.id === conversationId) ??
        -1;
      if (!session || deletedIndex < 0) return;

      let remaining = session.conversations.filter(
        (conversation) => conversation.id !== conversationId,
      );
      if (remaining.length === 0) remaining = [createEmptyConversation()];
      const nextConversation =
        remaining[Math.min(deletedIndex, remaining.length - 1)];
      const deletingActive = session.activeConversationId === conversationId;

      setSessions((previous) =>
        previous.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                activeConversationId: deletingActive
                  ? nextConversation.id
                  : item.activeConversationId,
                conversations: remaining,
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
      if (deletingActive) {
        setSelectedEventId(nextConversation.events.at(-1)?.id ?? null);
      }
      toast.success("Conversation deleted");
    },
    [
      activeSessionIdRef,
      agentStatus,
      sessionsRef,
      setSelectedEventId,
      setSessions,
    ],
  );

  /** Switches Desktop ownership and re-verifies an attached stream without obscuring a live viewer. */
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
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);
      setSelectedEventId(conversation?.events.at(-1)?.id ?? null);
      setAgentStatus("idle");
      if (session?.sandboxId && streamUrlsRef.current[sessionId]) {
        void verifyDesktop(sessionId, false);
      }
    },
    [
      activeSessionIdRef,
      agentStatus,
      sessionsRef,
      setActiveSessionId,
      setAgentStatus,
      setSelectedEventId,
      streamUrlsRef,
      verifyDesktop,
    ],
  );

  /** Stops remote compute first, then removes local history and selects the nearest remaining Desktop. */
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
    [
      activeSessionIdRef,
      agentStatus,
      destroyDesktop,
      removeStreamUrl,
      sessionsRef,
      setActiveSessionId,
      setAgentStatus,
      setSelectedEventId,
      setSessions,
    ],
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
    [agentStatus, sessionsRef],
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
    [agentStatus, sessionsRef],
  );

  const closeRenameSession = useCallback(() => {
    setRenameDesktopId(null);
  }, []);

  /** Renames Desktop metadata without changing Sandbox, Conversation, or active selection identity. */
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
    [agentStatus, setSessions],
  );

  /** Moves a Desktop across the pinned boundary while retaining stable order within each group. */
  const togglePinSession = useCallback(
    (sessionId: string) => {
      if (agentStatus !== "idle") return;
      setSessions((previous) => {
        const session = previous.find((item) => item.id === sessionId);
        if (!session) return previous;
        const pinned = !session.pinned;
        const updated = { ...session, pinned, updatedAt: Date.now() };
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
    [agentStatus, sessionsRef, setSessions],
  );

  /** Applies drag/keyboard insertion semantics and adopts the destination pinned group. */
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
    [agentStatus, setSessions],
  );

  /** Projects live messages/events into the owning Conversation and derives its first title once. */
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
          if (
            !current ||
            (latest.status === "pending" && currentEvent?.status !== "pending")
          ) {
            return latest.id;
          }
          return current;
        });
      }
    },
    [activeSessionIdRef, sessionsRef, setSelectedEventId, setSessions],
  );

  /** Persists FIFO changes only into the specified Conversation. */
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
    [setSessions],
  );

  return {
    isCreateDesktopOpen,
    deleteDesktopId,
    renameDesktopId,
    createSession,
    requestCreateSession,
    closeCreateSession,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    selectSession,
    deleteSession,
    requestDeleteSession,
    closeDeleteSession,
    requestRenameSession,
    closeRenameSession,
    renameSession,
    togglePinSession,
    reorderSessions,
    updateConversation,
    updatePromptQueue,
  };
}
