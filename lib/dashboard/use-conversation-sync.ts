/**
 * File: lib/dashboard/use-conversation-sync.ts
 * Purpose: Throttle live chat persistence without mixing storage effects into the view.
 * Problem solved: Prevents token-level streams from overwhelming the parent Session store.
 */
"use client";

import type { UIMessage } from "ai";
import { startTransition, useCallback, useEffect, useRef } from "react";
import type { ToolEvent } from "@/lib/dashboard/types";

const LIVE_SYNC_INTERVAL_MS = 100;

interface ConversationSyncOptions {
  sessionId: string;
  conversationId: string;
  messages: UIMessage[];
  events: ToolEvent[];
  status: string;
  onConversationChange: (
    sessionId: string,
    conversationId: string,
    messages: UIMessage[],
    events: ToolEvent[],
  ) => void;
}

/** Throttles parent-store projection while streaming and flushes immediately when a run settles. */
export function useConversationSync({
  sessionId,
  conversationId,
  messages,
  events,
  status,
  onConversationChange,
}: ConversationSyncOptions) {
  const lastSyncedMessagesRef = useRef<UIMessage[] | null>(null);
  const lastSyncedEventsRef = useRef<ToolEvent[] | null>(null);
  const pendingSyncRef = useRef<{
    messages: UIMessage[];
    events: ToolEvent[];
  } | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  const flushConversationSync = useCallback(() => {
    const pending = pendingSyncRef.current;
    if (!pending) return;
    pendingSyncRef.current = null;
    lastSyncedMessagesRef.current = pending.messages;
    lastSyncedEventsRef.current = pending.events;
    startTransition(() => {
      onConversationChange(
        sessionId,
        conversationId,
        pending.messages,
        pending.events,
      );
    });
  }, [conversationId, onConversationChange, sessionId]);

  useEffect(() => {
    if (
      lastSyncedMessagesRef.current === messages &&
      lastSyncedEventsRef.current === events
    ) {
      return;
    }
    pendingSyncRef.current = { messages, events };

    if (status === "submitted" || status === "streaming") {
      if (syncTimerRef.current === null) {
        syncTimerRef.current = window.setTimeout(() => {
          syncTimerRef.current = null;
          flushConversationSync();
        }, LIVE_SYNC_INTERVAL_MS);
      }
      return;
    }

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    flushConversationSync();
  }, [events, flushConversationSync, messages, status]);

  useEffect(
    () => () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    },
    [],
  );
}
