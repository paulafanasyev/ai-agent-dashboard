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
  clearConnectionController,
  clearConnectionTimer,
  connectionControllerFor,
  type ConnectionController,
} from "@/lib/dashboard/desktop-connection-controller";
import {
  finishRuntimeEvent,
  startRuntimeEvent,
} from "@/lib/dashboard/events";
import { persistSessions } from "@/lib/dashboard/session-storage";
import type { ChatSession, RuntimeEvent } from "@/lib/dashboard/types";
import {
  VNC_HANDSHAKE_TIMEOUT_MS,
  VNC_OFFLINE_GRACE_MS,
  vncReconnectDelayMs,
} from "@/lib/dashboard/vnc-connection";
import { useDesktopHealth } from "@/lib/dashboard/use-desktop-health";
import {
  diagnoseDesktop,
  getDesktopURL,
} from "@/lib/sandbox/utils";

interface DesktopRuntimeOptions {
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  isHydrated: boolean;
}

/**
 * Coordinates client-side Sandbox connection state, stream URLs, viewer recovery, diagnostics,
 * runtime events, and explicit cleanup while keeping all chat state outside the VNC subtree.
 */
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
  const controllersRef = useRef(new Map<string, ConnectionController>());
  const connectDesktopRef = useRef<
    (sessionId: string, queueIfBusy?: boolean) => void
  >(() => {});

  useEffect(() => void (sessionsRef.current = sessions), [sessions]);
  useEffect(() => void (streamUrlsRef.current = streamUrls), [streamUrls]);
  useEffect(
    () => void (activeSessionIdRef.current = activeSessionId),
    [activeSessionId],
  );

  /** Inserts or replaces one lifecycle event while bounding per-Desktop history to 200 entries. */
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

  const controllerFor = useCallback((sessionId: string) => {
    return connectionControllerFor(controllersRef.current, sessionId);
  }, []);

  const removeStreamUrl = useCallback((sessionId: string) => {
    setStreamUrls((previous) => {
      if (!(sessionId in previous)) return previous;
      const next = { ...previous };
      delete next[sessionId];
      return next;
    });
  }, []);

  useEffect(() => {
    const activeIds = new Set(sessions.map((session) => session.id));
    for (const [sessionId, controller] of controllersRef.current) {
      if (activeIds.has(sessionId)) continue;
      clearConnectionController(controller);
      controllersRef.current.delete(sessionId);
    }
  }, [sessions]);

  useEffect(
    () => () => {
      for (const controller of controllersRef.current.values()) {
        clearConnectionController(controller);
      }
    },
    [],
  );

  /** Schedules one reconnect with capped backoff; an immediate request replaces an existing timer. */
  const scheduleReconnect = useCallback(
    (sessionId: string, immediate = false) => {
      const controller = controllerFor(sessionId);
      if (controller.retryTimer !== null) {
        if (!immediate) return;
        clearConnectionTimer(controller, "retryTimer");
      }
      const delayMs = immediate
        ? 0
        : vncReconnectDelayMs(controller.retryAttempt++);
      controller.retryTimer = window.setTimeout(() => {
        controller.retryTimer = null;
        removeStreamUrl(sessionId);
        if (activeSessionIdRef.current !== sessionId) {
          setSessions((previous) =>
            previous.map((session) =>
              session.id === sessionId
                ? { ...session, connectionStatus: "offline" }
                : session,
            ),
          );
          return;
        }
        connectDesktopRef.current(sessionId, true);
      }, delayMs);
    },
    [controllerFor, removeStreamUrl, setSessions],
  );

  /**
   * Serializes Desktop allocation/reconnection, publishes the stream URL, and starts a separate
   * viewer-handshake timeout. Busy requests collapse into one pending reconnect.
   */
  const connectDesktop = useCallback(
    async (sessionId: string, queueIfBusy = false) => {
      const controller = controllerFor(sessionId);
      if (
        connectingRef.current.has(sessionId) ||
        verifyingRef.current.has(sessionId)
      ) {
        if (queueIfBusy) controller.pendingConnect = true;
        return;
      }
      if (!queueIfBusy && controller.retryTimer !== null) return;
      clearConnectionController(controller);
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
        controller.handshakeTimer = window.setTimeout(() => {
          controller.handshakeTimer = null;
          if (viewerReadyRef.current.has(sessionId)) return;
          setSessions((previous) =>
            previous.map((item) =>
              item.id === sessionId
                ? { ...item, connectionStatus: "reconnecting" }
                : item,
            ),
          );
          removeStreamUrl(sessionId);
          if (activeSessionIdRef.current === sessionId) {
            scheduleReconnect(sessionId);
          }
        }, VNC_HANDSHAKE_TIMEOUT_MS);
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
        if (controller.retryAttempt === 0) {
          toast.error("Failed to initialize the desktop", {
            description:
              "The VNC stream is reconnecting with backoff. You can also retry manually.",
          });
        }
        scheduleReconnect(sessionId);
      } finally {
        connectingRef.current.delete(sessionId);
        if (controller.pendingConnect) {
          controller.pendingConnect = false;
          scheduleReconnect(sessionId, true);
        }
      }
    },
    [
      controllerFor,
      removeStreamUrl,
      scheduleReconnect,
      setSessions,
      upsertRuntimeEvent,
    ],
  );

  useEffect(() => {
    connectDesktopRef.current = connectDesktop;
  }, [connectDesktop]);

  /** Keeps a disconnected iframe mounted during the grace period before replacing its stream URL. */
  const scheduleViewerRecovery = useCallback(
    (sessionId: string) => {
      const controller = controllerFor(sessionId);
      if (controller.offlineTimer !== null) return;
      controller.offlineTimer = window.setTimeout(() => {
        controller.offlineTimer = null;
        if (viewerReadyRef.current.has(sessionId)) return;
        removeStreamUrl(sessionId);
        if (activeSessionIdRef.current === sessionId) {
          scheduleReconnect(sessionId);
        }
      }, VNC_OFFLINE_GRACE_MS);
    },
    [controllerFor, removeStreamUrl, scheduleReconnect],
  );

  const verifyDesktop = useDesktopHealth({
    isHydrated,
    sessionsRef,
    streamUrlsRef,
    activeSessionIdRef,
    connectingRef,
    verifyingRef,
    viewerReadyRef,
    controllerFor,
    scheduleReconnect,
    removeStreamUrl,
    setSessions,
    upsertRuntimeEvent,
  });

  useEffect(() => {
    if (!isHydrated || process.env.NEXT_PUBLIC_E2E_MODE === "true") return;
    const activeSession = sessions.find(
      (session) => session.id === activeSessionId,
    );
    if (!activeSession) return;
    if (
      !streamUrls[activeSession.id] &&
      (activeSession.connectionStatus === "uninitialized" ||
        activeSession.connectionStatus === "offline" ||
        activeSession.connectionStatus === "error" ||
        activeSession.connectionStatus === "checking" ||
        activeSession.connectionStatus === "reconnecting")
    ) {
      void connectDesktop(activeSession.id);
    }
  }, [activeSessionId, connectDesktop, isHydrated, sessions, streamUrls]);

  useEffect(() => {
    const persistBeforePageExit = () => persistSessions(sessionsRef.current);
    window.addEventListener("pagehide", persistBeforePageExit);
    return () => window.removeEventListener("pagehide", persistBeforePageExit);
  }, []);

  /** Resets retry state and forces a fresh connection attempt for the active Desktop only. */
  const refreshActiveDesktop = useCallback(() => {
    if (!activeSessionIdRef.current) return;
    const sessionId = activeSessionIdRef.current;
    const controller = controllerFor(sessionId);
    controller.retryAttempt = 0;
    controller.pendingConnect = false;
    clearConnectionController(controller);
    viewerReadyRef.current.delete(sessionId);
    removeStreamUrl(sessionId);
    setSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? { ...session, connectionStatus: "reconnecting" }
          : session,
      ),
    );
    void connectDesktop(sessionId, true);
  }, [
    connectDesktop,
    controllerFor,
    removeStreamUrl,
    setSessions,
  ]);

  /** Runs credential-free server diagnostics against the active Sandbox, if one exists. */
  const runActiveDesktopDiagnostics = useCallback(async () => {
    const session = sessionsRef.current.find(
      (item) => item.id === activeSessionIdRef.current,
    );
    return diagnoseDesktop(session?.sandboxId ?? undefined);
  }, []);

  /** Requests remote shutdown and records the result without blocking later local cleanup forever. */
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

  /**
   * Reconciles noVNC iframe state with the connection controller. Ready cancels recovery timers;
   * offline/reconnecting retains the iframe briefly and records viewer lifecycle events.
   */
  const handleViewerStateChange = useCallback(
    (sessionId: string, state: VncViewerState) => {
      if (sessionId !== activeSessionIdRef.current) return;
      const controller = controllerFor(sessionId);
      if (state === "ready") {
        clearConnectionController(controller);
        controller.retryAttempt = 0;
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
        setSessions((previous) =>
          previous.map((session) =>
            session.id === sessionId
              ? { ...session, connectionStatus: "ready" }
              : session,
          ),
        );
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
        scheduleViewerRecovery(sessionId);
      } else if (state === "reconnecting") {
        scheduleViewerRecovery(sessionId);
      }
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                connectionStatus:
                  state === "offline" || state === "reconnecting"
                    ? "reconnecting"
                    : "checking",
              }
            : session,
        ),
      );
    },
    [
      controllerFor,
      scheduleViewerRecovery,
      setSessions,
      upsertRuntimeEvent,
      verifyDesktop,
    ],
  );

  return {
    streamUrls,
    streamUrlsRef,
    viewerReadyRef,
    verifyDesktop,
    removeStreamUrl,
    destroyDesktop,
    refreshActiveDesktop,
    runActiveDesktopDiagnostics,
    handleViewerStateChange,
  };
}
