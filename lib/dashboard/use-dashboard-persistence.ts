/**
 * File: lib/dashboard/use-dashboard-persistence.ts
 * Purpose: Hydrate and persist dashboard sessions, active selection, and model settings.
 * Problem solved: Restores browser-local work safely while keeping BYOK credentials scoped to the current tab.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_MODEL_CONFIG,
  MODEL_SETTINGS_STORAGE_KEY,
  parseStoredModelConfig,
  type ClientModelConfig,
} from "@/lib/ai/model-config";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  createEmptySession,
  getNextDesktopName,
  loadSessions,
  persistSessions,
} from "@/lib/dashboard/session-storage";
import type { ChatSession } from "@/lib/dashboard/types";

/** Hydrates browser state once, then persists Sessions during idle time and BYOK per tab. */
export function useDashboardPersistence() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<ClientModelConfig>(
    DEFAULT_MODEL_CONFIG,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const sessionsRef = useRef(sessions);
  const activeSessionIdRef = useRef(activeSessionId);
  const skipNextSessionPersistenceRef = useRef(false);

  useEffect(() => void (sessionsRef.current = sessions), [sessions]);
  useEffect(
    () => void (activeSessionIdRef.current = activeSessionId),
    [activeSessionId],
  );

  useEffect(() => {
    const loadedSessions = loadSessions();
    const hasSnapshot = localStorage.getItem(SESSION_STORAGE_KEY) !== null;
    const nextSessions =
      loadedSessions.length > 0 || hasSnapshot
        ? loadedSessions
        : [createEmptySession(getNextDesktopName([]))];
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
    if (skipNextSessionPersistenceRef.current) {
      skipNextSessionPersistenceRef.current = false;
      return;
    }
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

  const clearLocalDashboardData = useCallback(() => {
    skipNextSessionPersistenceRef.current = true;
    localStorage.clear();
    sessionStorage.clear();
    sessionsRef.current = [];
    activeSessionIdRef.current = null;
    setSessions([]);
    setActiveSessionId(null);
    setModelConfig(DEFAULT_MODEL_CONFIG);
  }, []);

  return {
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
  };
}
