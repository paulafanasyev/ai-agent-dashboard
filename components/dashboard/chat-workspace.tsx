/**
 * File: components/dashboard/chat-workspace.tsx
 * Purpose: Own the streaming conversation UI and project tool calls into agent events.
 * Problem solved: Keeps one conversation synchronized while reusing its parent session's desktop.
 */
"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Plus } from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Input } from "@/components/input";
import { PreviewMessage } from "@/components/message";
import { ProjectInfo } from "@/components/project-info";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import type { ClientModelConfig } from "@/lib/ai/model-config";
import {
  deriveAgentStatus,
  syncAgentEvents,
} from "@/lib/dashboard/events";
import type {
  AgentEvent,
  AgentStatus,
  ChatConversation,
  ConnectionStatus,
  QueuedPrompt,
} from "@/lib/dashboard/types";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { ABORTED } from "@/lib/utils";
import { AgentActivity } from "./agent-activity";
import { ConversationSwitcher } from "./conversation-switcher";
import { DebugPanel } from "./debug-panel";
import { PromptQueue } from "./prompt-queue";

const LIVE_SYNC_INTERVAL_MS = 100;

interface ChatWorkspaceProps {
  sessionId: string;
  conversationId: string;
  conversationRevision: number;
  conversations: ChatConversation[];
  sandboxId: string | null;
  initialMessages: UIMessage[];
  initialEvents: AgentEvent[];
  initialQueuedPrompts: QueuedPrompt[];
  modelConfig: ClientModelConfig;
  connectionReady: boolean;
  connectionStatus: ConnectionStatus;
  selectedEventId: string | null;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onConversationChange: (
    sessionId: string,
    conversationId: string,
    messages: UIMessage[],
    events: AgentEvent[],
  ) => void;
  onQueueChange: (
    sessionId: string,
    conversationId: string,
    queuedPrompts: QueuedPrompt[],
  ) => void;
  onStatusChange: (status: AgentStatus) => void;
}

function ChatWorkspaceComponent({
  sessionId,
  conversationId,
  conversationRevision,
  conversations,
  sandboxId,
  initialMessages,
  initialEvents,
  initialQueuedPrompts,
  modelConfig,
  connectionReady,
  connectionStatus,
  selectedEventId,
  onCreateConversation,
  onSelectConversation,
  onSelectEvent,
  onConversationChange,
  onQueueChange,
  onStatusChange,
}: ChatWorkspaceProps) {
  const [containerRef, endRef] = useScrollToBottom();
  const eventsRef = useRef(initialEvents);
  const composerRef = useRef<HTMLInputElement>(null);
  const lastSyncedMessagesRef = useRef<UIMessage[] | null>(null);
  const lastSyncedEventsRef = useRef<AgentEvent[] | null>(null);
  const pendingConversationSyncRef = useRef<{
    messages: UIMessage[];
    events: AgentEvent[];
  } | null>(null);
  const conversationSyncTimerRef = useRef<number | null>(null);
  const queueRef = useRef(initialQueuedPrompts);
  const runLockRef = useRef(false);
  const activePromptRef = useRef<QueuedPrompt | null>(null);
  const replaceQueueRef = useRef<(nextQueue: QueuedPrompt[]) => void>(() => {});
  const [queuedPrompts, setQueuedPrompts] = useState(initialQueuedPrompts);

  const {
    messages,
    input,
    handleInputChange,
    status,
    stop: stopGeneration,
    append,
    setInput,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: `${sessionId}:${conversationId}:${conversationRevision}`,
    initialMessages,
    body: { sandboxId, modelConfig, desktopReady: connectionReady },
    maxSteps: 30,
    onError: (error) => {
      const activePrompt = activePromptRef.current;
      if (
        activePrompt &&
        error.message.toLowerCase().includes("desktop is not ready")
      ) {
        activePromptRef.current = null;
        replaceQueueRef.current([activePrompt, ...queueRef.current]);
        toast.info("Task returned to queue", {
          description: "It will retry automatically when Desktop is Ready.",
        });
        return;
      }
      activePromptRef.current = null;
      toast.error("Model request failed", {
        description:
          modelConfig.provider === "anthropic"
            ? "Check the project's Claude configuration and try again."
            : "Check the API key, Base URL, model ID, and account balance.",
        richColors: true,
        position: "top-center",
      });
    },
    onFinish: () => {
      activePromptRef.current = null;
    },
  });

  const events = useMemo(() => {
    const next = syncAgentEvents(conversationId, eventsRef.current, messages);
    eventsRef.current = next;
    return next;
  }, [conversationId, messages]);

  const agentStatus = deriveAgentStatus(status, events);
  const isLoading = status === "submitted" || status === "streaming";

  const replaceQueue = useCallback(
    (nextQueue: QueuedPrompt[]) => {
      queueRef.current = nextQueue;
      setQueuedPrompts(nextQueue);
      onQueueChange(sessionId, conversationId, nextQueue);
    },
    [conversationId, onQueueChange, sessionId],
  );
  replaceQueueRef.current = replaceQueue;

  const queueOrRunPrompt = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;

      const canRunNow =
        connectionReady &&
        !isLoading &&
        !runLockRef.current &&
        queueRef.current.length === 0;
      if (canRunNow) {
        activePromptRef.current = {
          id: crypto.randomUUID(),
          text,
          createdAt: Date.now(),
        };
        runLockRef.current = true;
        void append({ role: "user", content: text }).finally(() => {
          runLockRef.current = false;
          setQueuedPrompts((current) => [...current]);
        });
        return;
      }

      if (queueRef.current.length >= 20) {
        toast.info("The task queue is full", {
          description: "Remove a queued task before adding another.",
        });
        return;
      }

      replaceQueue([
        ...queueRef.current,
        { id: crypto.randomUUID(), text, createdAt: Date.now() },
      ]);
    },
    [append, connectionReady, isLoading, replaceQueue],
  );

  useEffect(() => {
    if (
      !connectionReady ||
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
  }, [append, connectionReady, isLoading, queuedPrompts, replaceQueue]);

  useEffect(() => {
    onStatusChange(agentStatus);
  }, [agentStatus, onStatusChange]);

  const flushConversationSync = useCallback(() => {
    const pending = pendingConversationSyncRef.current;
    if (!pending) return;
    pendingConversationSyncRef.current = null;
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
    pendingConversationSyncRef.current = { messages, events };

    if (status === "submitted" || status === "streaming") {
      if (conversationSyncTimerRef.current === null) {
        conversationSyncTimerRef.current = window.setTimeout(() => {
          conversationSyncTimerRef.current = null;
          flushConversationSync();
        }, LIVE_SYNC_INTERVAL_MS);
      }
      return;
    }

    if (conversationSyncTimerRef.current !== null) {
      window.clearTimeout(conversationSyncTimerRef.current);
      conversationSyncTimerRef.current = null;
    }
    flushConversationSync();
  }, [events, flushConversationSync, messages, status]);

  useEffect(
    () => () => {
      if (conversationSyncTimerRef.current !== null) {
        window.clearTimeout(conversationSyncTimerRef.current);
      }
    },
    [],
  );

  const stop = () => {
    activePromptRef.current = null;
    stopGeneration();
    const lastMessage = messages.at(-1);
    const lastPart = lastMessage?.parts.at(-1);

    if (
      lastMessage?.role === "assistant" &&
      lastPart?.type === "tool-invocation"
    ) {
      setMessages((previous) => [
        ...previous.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastPart,
              toolInvocation: {
                ...lastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const submitComposer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input;
    if (!value.trim()) return;
    setInput("");
    queueOrRunPrompt(value);
  };

  const createOrFocusConversation = () => {
    const conversationIsEmpty =
      messages.length === 0 &&
      events.length === 0 &&
      queuedPrompts.length === 0;
    if (conversationIsEmpty) {
      composerRef.current?.focus();
      return;
    }
    onCreateConversation();
  };

  const selectPresetPrompt = (prompt: string) => {
    setInput(prompt);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-zinc-50/80 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <ConversationSwitcher
            conversations={conversations}
            activeConversationId={conversationId}
            disabled={isLoading}
            onSelect={onSelectConversation}
          />
          {events.length > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
              {events.length} events
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={createOrFocusConversation}
          disabled={isLoading}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-surface hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">New</span>
        </button>
      </header>

      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        ref={containerRef}
      >
        {messages.length === 0 ? (
          <ProjectInfo />
        ) : null}
        {messages.map((message, index) => (
          <PreviewMessage
            message={message}
            key={message.id}
            isLoading={isLoading}
            status={status}
            isLatestMessage={index === messages.length - 1}
            selectedEventId={selectedEventId}
            onSelectEvent={onSelectEvent}
          />
        ))}
        <div ref={endRef} className="pb-2" />
      </div>

      {messages.length === 0 ? (
        <PromptSuggestions
          disabled={false}
          onSelectPrompt={selectPresetPrompt}
        />
      ) : null}

      <AgentActivity
        chatStatus={status}
        connectionReady={connectionReady}
        connectionStatus={connectionStatus}
        events={events}
        queueCount={queuedPrompts.length}
      />

      <PromptQueue
        prompts={queuedPrompts}
        waitingForDesktop={!connectionReady}
        onRemove={(promptId) =>
          replaceQueue(
            queueRef.current.filter((prompt) => prompt.id !== promptId),
          )
        }
      />

      <DebugPanel events={events} />

      <div className="shrink-0 bg-surface px-3 pb-3 pt-1">
        <form onSubmit={submitComposer}>
          <Input
            handleInputChange={handleInputChange}
            input={input}
            inputRef={composerRef}
            isInitializing={!connectionReady}
            isLoading={isLoading}
            hasQueuedPrompts={queuedPrompts.length > 0}
            stop={stop}
          />
        </form>
      </div>
    </section>
  );
}

function conversationNavigationEqual(
  previous: ChatConversation[],
  next: ChatConversation[],
) {
  return (
    previous.length === next.length &&
    previous.every((conversation, index) => {
      const candidate = next[index];
      return (
        conversation.id === candidate.id &&
        conversation.title === candidate.title &&
        conversation.messages.length === candidate.messages.length &&
        conversation.queuedPrompts.length === candidate.queuedPrompts.length
      );
    })
  );
}

export const ChatWorkspace = memo(
  ChatWorkspaceComponent,
  (previous, next) =>
    previous.sessionId === next.sessionId &&
    previous.conversationId === next.conversationId &&
    previous.conversationRevision === next.conversationRevision &&
    previous.sandboxId === next.sandboxId &&
    previous.modelConfig === next.modelConfig &&
    previous.connectionReady === next.connectionReady &&
    previous.connectionStatus === next.connectionStatus &&
    previous.selectedEventId === next.selectedEventId &&
    previous.onCreateConversation === next.onCreateConversation &&
    previous.onSelectConversation === next.onSelectConversation &&
    previous.onSelectEvent === next.onSelectEvent &&
    previous.onConversationChange === next.onConversationChange &&
    previous.onQueueChange === next.onQueueChange &&
    previous.onStatusChange === next.onStatusChange &&
    conversationNavigationEqual(previous.conversations, next.conversations),
);
