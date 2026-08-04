/**
 * File: lib/dashboard/use-conversation-queue.ts
 * Purpose: Serialize queued prompts for one conversation independently from chat rendering.
 * Problem solved: Keeps follow-up tasks available while guaranteeing one safe Desktop run at a time.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { QueuedPrompt } from "@/lib/dashboard/types";

interface ConversationQueueOptions {
  sessionId: string;
  conversationId: string;
  initialQueuedPrompts: QueuedPrompt[];
  connectionReady: boolean;
  isLoading: boolean;
  modelConfigured: boolean;
  append: (message: { role: "user"; content: string }) => Promise<unknown>;
  onQueueChange: (
    sessionId: string,
    conversationId: string,
    queuedPrompts: QueuedPrompt[],
  ) => void;
  queueRef: { current: QueuedPrompt[] };
  runLockRef: { current: boolean };
  activePromptRef: { current: QueuedPrompt | null };
  replaceQueueRef: {
    current: (nextQueue: QueuedPrompt[]) => void;
  };
}

/**
 * Runs one prompt immediately only when the model and Desktop are ready; otherwise persists it
 * in the Conversation FIFO. The run lock prevents overlapping commands against one Sandbox.
 */
export function useConversationQueue({
  sessionId,
  conversationId,
  initialQueuedPrompts,
  connectionReady,
  isLoading,
  modelConfigured,
  append,
  onQueueChange,
  queueRef,
  runLockRef,
  activePromptRef,
  replaceQueueRef,
}: ConversationQueueOptions) {
  const [queuedPrompts, setQueuedPrompts] = useState(initialQueuedPrompts);

  /** Updates local render state, the synchronous ref, and persisted Conversation state together. */
  const replaceQueue = useCallback(
    (nextQueue: QueuedPrompt[]) => {
      queueRef.current = nextQueue;
      setQueuedPrompts(nextQueue);
      onQueueChange(sessionId, conversationId, nextQueue);
    },
    [conversationId, onQueueChange, queueRef, sessionId],
  );
  replaceQueueRef.current = replaceQueue;

  /** Acquires the per-Conversation run lock until AI SDK append settles. */
  const runPrompt = useCallback(
    (prompt: QueuedPrompt) => {
      activePromptRef.current = prompt;
      runLockRef.current = true;
      void append({ role: "user", content: prompt.text }).finally(() => {
        runLockRef.current = false;
        setQueuedPrompts((current) => [...current]);
      });
    },
    [activePromptRef, append, runLockRef],
  );

  /** Chooses immediate execution or bounded FIFO insertion from current readiness and run state. */
  const queueOrRunPrompt = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;
      if (!modelConfigured) {
        toast.info("Configure BYOK before running a task", {
          description: "Open Settings and add your provider API key.",
        });
        return;
      }

      const prompt = {
        id: crypto.randomUUID(),
        text,
        createdAt: Date.now(),
      };
      const canRunNow =
        connectionReady &&
        !isLoading &&
        !runLockRef.current &&
        queueRef.current.length === 0;
      if (canRunNow) {
        runPrompt(prompt);
        return;
      }

      if (queueRef.current.length >= 20) {
        toast.info("The task queue is full", {
          description: "Remove a queued task before adding another.",
        });
        return;
      }
      replaceQueue([...queueRef.current, prompt]);
    },
    [
      connectionReady,
      isLoading,
      modelConfigured,
      queueRef,
      replaceQueue,
      runLockRef,
      runPrompt,
    ],
  );

  useEffect(() => {
    if (
      !connectionReady ||
      !modelConfigured ||
      isLoading ||
      runLockRef.current ||
      queueRef.current.length === 0
    ) {
      return;
    }

    const [nextPrompt, ...remaining] = queueRef.current;
    activePromptRef.current = nextPrompt;
    runLockRef.current = true;
    replaceQueue(remaining);
    void append({ role: "user", content: nextPrompt.text }).finally(() => {
      runLockRef.current = false;
      setQueuedPrompts((current) => [...current]);
    });
  }, [
    connectionReady,
    isLoading,
    modelConfigured,
    queueRef,
    queuedPrompts,
    replaceQueue,
    runLockRef,
    activePromptRef,
    append,
  ]);

  const removePrompt = useCallback(
    (promptId: string) => {
      replaceQueue(
        queueRef.current.filter((prompt) => prompt.id !== promptId),
      );
    },
    [queueRef, replaceQueue],
  );

  return { queuedPrompts, queueOrRunPrompt, removePrompt };
}
