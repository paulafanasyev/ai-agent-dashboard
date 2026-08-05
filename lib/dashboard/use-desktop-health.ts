/**
 * File: lib/dashboard/use-desktop-health.ts
 * Purpose: Verify Sandbox/noVNC health and run periodic checks outside runtime orchestration.
 * Problem solved: Detects stale remote desktops and coordinates recovery without bloating the main runtime hook.
 */
"use client";

import { useCallback, useEffect } from "react";
import type { ConnectionController } from "@/lib/dashboard/desktop-connection-controller";
import {
  finishRuntimeEvent,
  startRuntimeEvent,
} from "@/lib/dashboard/events";
import type { ChatSession, RuntimeEvent } from "@/lib/dashboard/types";
import { checkDesktopHealth } from "@/lib/sandbox/utils";

interface DesktopHealthOptions {
  isHydrated: boolean;
  sessionsRef: { current: ChatSession[] };
  streamUrlsRef: { current: Record<string, string> };
  retainedSessionIdsRef: { current: string[] };
  connectingRef: { current: Set<string> };
  verifyingRef: { current: Set<string> };
  viewerReadyRef: { current: Set<string> };
  controllerFor: (sessionId: string) => ConnectionController;
  scheduleReconnect: (sessionId: string, immediate?: boolean) => void;
  removeStreamUrl: (sessionId: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  upsertRuntimeEvent: (
    sessionId: string,
    runtimeEvent: RuntimeEvent,
  ) => void;
}

/**
 * Serializes server health probes and rechecks known Desktops on an interval, focus, and visibility.
 * Healthy services do not imply Ready until a retained browser viewer has confirmed its handshake.
 */
export function useDesktopHealth({
  isHydrated,
  sessionsRef,
  streamUrlsRef,
  retainedSessionIdsRef,
  connectingRef,
  verifyingRef,
  viewerReadyRef,
  controllerFor,
  scheduleReconnect,
  removeStreamUrl,
  setSessions,
  upsertRuntimeEvent,
}: DesktopHealthOptions) {
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
      const controller = controllerFor(sessionId);
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
        const viewerIsRetained =
          retainedSessionIdsRef.current.includes(sessionId);
        const viewerIsConfirmed =
          !viewerIsRetained || viewerReadyRef.current.has(sessionId);
        const isHealthy = await checkDesktopHealth(
          sandboxId,
          !viewerIsConfirmed,
        );
        upsertRuntimeEvent(
          sessionId,
          finishRuntimeEvent(runtimeEvent, isHealthy ? "completed" : "error", {
            message: isHealthy
              ? "Sandbox and noVNC health checks passed."
              : "The desktop runtime did not pass its health checks.",
          }),
        );
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
          if (viewerIsRetained && !streamUrlsRef.current[sessionId]) {
            scheduleReconnect(sessionId);
          } else if (!viewerIsRetained) {
            removeStreamUrl(sessionId);
          }
        }
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
        if (
          retainedSessionIdsRef.current.includes(sessionId) &&
          !streamUrlsRef.current[sessionId]
        ) {
          scheduleReconnect(sessionId);
        } else if (!retainedSessionIdsRef.current.includes(sessionId)) {
          removeStreamUrl(sessionId);
        }
      } finally {
        verifyingRef.current.delete(sessionId);
        if (
          controller.pendingConnect &&
          !connectingRef.current.has(sessionId)
        ) {
          controller.pendingConnect = false;
          scheduleReconnect(sessionId, true);
        }
      }
    },
    [
      connectingRef,
      controllerFor,
      removeStreamUrl,
      retainedSessionIdsRef,
      scheduleReconnect,
      sessionsRef,
      setSessions,
      streamUrlsRef,
      upsertRuntimeEvent,
      verifyingRef,
      viewerReadyRef,
    ],
  );

  useEffect(() => {
    if (!isHydrated || process.env.NEXT_PUBLIC_E2E_MODE === "true") return;
    const verifyKnownDesktops = () => {
      for (const session of sessionsRef.current) {
        if (
          !retainedSessionIdsRef.current.includes(session.id) ||
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
    const interval = window.setInterval(verifyKnownDesktops, 15_000);
    window.addEventListener("focus", verifyKnownDesktops);
    document.addEventListener("visibilitychange", verifyWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", verifyKnownDesktops);
      document.removeEventListener("visibilitychange", verifyWhenVisible);
    };
  }, [
    connectingRef,
    isHydrated,
    retainedSessionIdsRef,
    sessionsRef,
    verifyDesktop,
  ]);

  return verifyDesktop;
}
