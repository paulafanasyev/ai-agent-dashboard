/**
 * File: lib/dashboard/use-desktop-runtime.ts
 * Purpose: Own Sandbox and noVNC connection state independently from chat state.
 * Problem solved: Keeps runtime lifecycle orchestration and its typed events out of the page composition layer.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { VncViewerState } from "@/components/dashboard/vnc-viewer";
import {
  finishRuntimeEvent,
  startRuntimeEvent,
} from "@/lib/dashboard/events";
import { persistSessions } from "@/lib/dashboard/session-storage";
import type { ChatSession, RuntimeEvent } from "@/lib/dashboard/types";
import { checkDesktopHealth, getDesktopURL } from "@/lib/sandbox/utils";

interface DesktopRuntimeOptions {
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  isHydrated: boolean;
}

export function useDesktopRuntime({
  sessions,
  setSessions,
  activeSessionId,
  isHydrated,
}: DesktopRuntimeOptions) {
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const sessionsRef = useRef(sessions);
  const streamUrlsRef = useRef(streamUrls);
  const activeSessionIdRef = useRef(activeSessionId);
  const connectingRef = useRef(new Set<string>());
  const verifyingRef = useRef(new Set<string>());
  const viewerReadyRef = useRef(new Set<string>());
  const viewerEventRef = useRef(new Map<string, RuntimeEvent>());

  useEffect(() => void (sessionsRef.current = sessions), [sessions]);
  useEffect(() => void (streamUrlsRef.current = streamUrls), [streamUrls]);
  useEffect(
    () => void (activeSessionIdRef.current = activeSessionId),
    [activeSessionId],
  );

  const upsertRuntimeEvent = useCallback(
    (sessionId: string, runtimeEvent: RuntimeEvent) => {
      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== sessionId) return session;
          const exists = session.runtimeEvents.some(
            (event) => event.id === runtimeEvent.id,
          );
          const runtimeEvents = exists
            ? session.runtimeEvents.map((event) =>
                event.id === runtimeEvent.id ? runtimeEvent : event,
              )
            : [...session.runtimeEvents, runtimeEvent];
          return {
            ...session,
            runtimeEvents: runtimeEvents.slice(-200),
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [setSessions],
  );

  const connectDesktop = useCallback(
    async (sessionId: string) => {
      if (
        connectingRef.current.has(sessionId) ||
        verifyingRef.current.has(sessionId)
      ) {
        return;
      }
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      if (!session) return;

      const runtimeEvent = startRuntimeEvent(
        sessionId,
        session.sandboxId ? "sandbox_reconnect" : "sandbox_create",
        {
          sandboxId: session.sandboxId ?? undefined,
          source: session.sandboxId ? "user" : "system",
          message: session.sandboxId
            ? "Resolving the existing Sandbox and noVNC stream."
            : "Allocating a new isolated Sandbox desktop.",
        },
      );
      upsertRuntimeEvent(sessionId, runtimeEvent);
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
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, "completed", {
            message: `Sandbox ${desktop.id} is available.`,
          }),
        );
        const viewerEvent = startRuntimeEvent(sessionId, "vnc_connect", {
          sandboxId: desktop.id,
          source: "viewer",
          message: "Waiting for the noVNC viewer handshake.",
        });
        viewerEventRef.current.set(sessionId, viewerEvent);
        upsertRuntimeEvent(sessionId, viewerEvent);
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
      } catch (error) {
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, "error", {
            message:
              error instanceof Error
                ? error.message
                : "Sandbox initialization failed.",
          }),
        );
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
    },
    [setSessions, upsertRuntimeEvent],
  );

  const removeStreamUrl = useCallback((sessionId: string) => {
    setStreamUrls((previous) => {
      if (!(sessionId in previous)) return previous;
      const next = { ...previous };
      delete next[sessionId];
      return next;
    });
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
      const runtimeEvent = startRuntimeEvent(
        sessionId,
        "sandbox_health_check",
        {
          sandboxId,
          source: showChecking ? "user" : "system",
          message: "Checking Sandbox processes and the noVNC endpoint.",
        },
      );
      upsertRuntimeEvent(sessionId, runtimeEvent);
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
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, isHealthy ? "completed" : "error", {
            message: isHealthy
              ? "Sandbox and noVNC health checks passed."
              : "The desktop runtime did not pass its health checks.",
          }),
        );
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
        if (!isHealthy) removeStreamUrl(sessionId);
      } catch (error) {
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, "error", {
            message:
              error instanceof Error
                ? error.message
                : "Desktop health check failed.",
          }),
        );
        setSessions((previous) =>
          previous.map((item) =>
            item.id === sessionId && item.sandboxId === sandboxId
              ? { ...item, connectionStatus: "offline" }
              : item,
          ),
        );
        removeStreamUrl(sessionId);
      } finally {
        verifyingRef.current.delete(sessionId);
      }
    },
    [removeStreamUrl, setSessions, upsertRuntimeEvent],
  );

  useEffect(() => {
    if (!isHydrated || process.env.NEXT_PUBLIC_E2E_MODE === "true") return;
    const activeSession = sessions.find(
      (session) => session.id === activeSessionId,
    );
    if (!activeSession) return;
    if (
      !streamUrls[activeSession.id] &&
      (activeSession.connectionStatus === "uninitialized" ||
        activeSession.connectionStatus === "offline")
    ) {
      void connectDesktop(activeSession.id);
    }
  }, [activeSessionId, connectDesktop, isHydrated, sessions, streamUrls]);

  useEffect(() => {
    if (!isHydrated || process.env.NEXT_PUBLIC_E2E_MODE === "true") return;
    const verifyKnownDesktops = () => {
      for (const session of sessionsRef.current) {
        if (
          !session.sandboxId ||
          session.connectionStatus === "creating" ||
          connectingRef.current.has(session.id)
        ) continue;
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

  const refreshActiveDesktop = useCallback(() => {
    if (!activeSessionIdRef.current) return;
    if (verifyingRef.current.has(activeSessionIdRef.current)) return;
    viewerReadyRef.current.delete(activeSessionIdRef.current);
    removeStreamUrl(activeSessionIdRef.current);
    void connectDesktop(activeSessionIdRef.current);
  }, [connectDesktop, removeStreamUrl]);

  const destroyDesktop = useCallback(
    async (sessionId: string, sandboxId: string) => {
      const runtimeEvent = startRuntimeEvent(sessionId, "sandbox_destroy", {
        sandboxId,
        source: "user",
        message: "Requesting Sandbox shutdown before removing local history.",
      });
      upsertRuntimeEvent(sessionId, runtimeEvent);
      try {
        const response = await fetch(
          `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
          { method: "POST" },
        );
        if (!response.ok) throw new Error(await response.text());
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, "completed", {
            message: "Sandbox shutdown completed.",
          }),
        );
      } catch (error) {
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, "error", {
            message:
              error instanceof Error ? error.message : "Sandbox shutdown failed.",
          }),
        );
      }
    },
    [upsertRuntimeEvent],
  );

  const handleViewerStateChange = useCallback(
    (sessionId: string, state: VncViewerState) => {
      if (sessionId !== activeSessionIdRef.current) return;
      if (state === "ready") {
        viewerReadyRef.current.add(sessionId);
        const pending = viewerEventRef.current.get(sessionId);
        if (pending) {
          upsertRuntimeEvent(
            sessionId,
            finishRuntimeEvent(pending, "completed", {
              message: "The noVNC viewer completed its handshake.",
            }),
          );
          viewerEventRef.current.delete(sessionId);
        }
        void verifyDesktop(sessionId, false);
        return;
      }

      if (
        state === "reconnecting" &&
        !viewerEventRef.current.has(sessionId)
      ) {
        const reconnectEvent = startRuntimeEvent(sessionId, "vnc_connect", {
          sandboxId:
            sessionsRef.current.find((session) => session.id === sessionId)
              ?.sandboxId ?? undefined,
          source: "viewer",
          message: "The noVNC viewer is attempting to reconnect.",
        });
        viewerEventRef.current.set(sessionId, reconnectEvent);
        upsertRuntimeEvent(sessionId, reconnectEvent);
      }

      viewerReadyRef.current.delete(sessionId);
      if (state === "offline") {
        const pending = viewerEventRef.current.get(sessionId);
        if (pending) {
          upsertRuntimeEvent(
            sessionId,
            finishRuntimeEvent(pending, "error", {
              message: "The noVNC viewer disconnected before becoming ready.",
            }),
          );
          viewerEventRef.current.delete(sessionId);
        }
        const disconnected = startRuntimeEvent(sessionId, "vnc_disconnect", {
          sandboxId:
            sessionsRef.current.find((session) => session.id === sessionId)
              ?.sandboxId ?? undefined,
          source: "viewer",
          message: "The live desktop viewer reported an offline state.",
        });
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(disconnected, "completed"),
        );
        removeStreamUrl(sessionId);
      }
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
    },
    [removeStreamUrl, setSessions, upsertRuntimeEvent, verifyDesktop],
  );

  return {
    streamUrls,
    streamUrlsRef,
    viewerReadyRef,
    verifyDesktop,
    removeStreamUrl,
    destroyDesktop,
    refreshActiveDesktop,
    handleViewerStateChange,
  };
}
