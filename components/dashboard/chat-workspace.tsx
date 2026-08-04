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
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { Input } from "@/components/input";
import { PreviewMessage } from "@/components/message";
import { ProjectInfo } from "@/components/project-info";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import type { ClientModelConfig } from "@/lib/ai/model-config";
import {
  deriveAgentStatus,
  mergeEventTimeline,
  syncAgentEvents,
} from "@/lib/dashboard/events";
import type {
  AgentStatus,
  ChatConversation,
  ConnectionStatus,
  QueuedPrompt,
  RuntimeEvent,
  ToolEvent,
} from "@/lib/dashboard/types";
import { openApiSettings } from "@/lib/dashboard/settings-events";
import { useConversationQueue } from "@/lib/dashboard/use-conversation-queue";
import { useConversationSync } from "@/lib/dashboard/use-conversation-sync";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { ABORTED, prunedMessages } from "@/lib/utils";
import { AgentActivity } from "./agent-activity";
import { ConversationSwitcher } from "./conversation-switcher";
import { DebugPanel } from "./debug-panel";
import { PromptQueue } from "./prompt-queue";

interface ChatWorkspaceProps {
  sessionId: string;
  conversationId: string;
  conversationRevision: number;
  conversations: ChatConversation[];
  sandboxId: string | null;
  initialMessages: UIMessage[];
  initialEvents: ToolEvent[];
  runtimeEvents: RuntimeEvent[];
  initialQueuedPrompts: QueuedPrompt[];
  modelConfig: ClientModelConfig;
  modelConfigured: boolean;
  connectionReady: boolean;
  connectionStatus: ConnectionStatus;
  selectedEventId: string | null;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, name: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onConversationChange: (
    sessionId: string,
    conversationId: string,
    messages: UIMessage[],
    events: ToolEvent[],
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
  runtimeEvents,
  initialQueuedPrompts,
  modelConfig,
  modelConfigured,
  connectionReady,
  connectionStatus,
  selectedEventId,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onSelectEvent,
  onConversationChange,
  onQueueChange,
  onStatusChange,
}: ChatWorkspaceProps) {
  const [containerRef, endRef] = useScrollToBottom();
  const eventsRef = useRef(initialEvents);
  const composerRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef(initialQueuedPrompts);
  const runLockRef = useRef(false);
  const activePromptRef = useRef<QueuedPrompt | null>(null);
  const replaceQueueRef = useRef<(nextQueue: QueuedPrompt[]) => void>(() => {});
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
    experimental_prepareRequestBody: ({ messages: requestMessages }) => ({
      messages: prunedMessages(requestMessages, {
        compactPriorToolCalls: true,
        preserveLatestScreenshot: true,
      }),
      sandboxId,
      modelConfig,
      desktopReady: connectionReady,
    }),
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
      const message = error.message.trim();
      toast.error("Model request failed", {
        description: message
          ? message.slice(0, 240)
          : "The model request ended without an error message. Retry this conversation once.",
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
  const timelineEvents = useMemo(
    () => mergeEventTimeline(events, runtimeEvents),
    [events, runtimeEvents],
  );
  const isLoading = status === "submitted" || status === "streaming";

  const { queuedPrompts, queueOrRunPrompt, removePrompt } =
    useConversationQueue({
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
    });

  const requestApiConfiguration = useCallback(() => {
    toast.info("API key required", {
      description: "Choose a provider and add its API key before running a task.",
      action: {
        label: "Configure",
        onClick: openApiSettings,
      },
    });
  }, []);

  useEffect(() => {
    onStatusChange(agentStatus);
  }, [agentStatus, onStatusChange]);

  useConversationSync({
    sessionId,
    conversationId,
    messages,
    events,
    status,
    onConversationChange,
  });

  /** Stops generation and resolves a pending tool invocation as aborted for a valid local timeline. */
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

  /** Clears the composer immediately, then delegates safe run-versus-queue selection to the queue hook. */
  const submitComposer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input;
    if (!value.trim()) return;
    setInput("");
    queueOrRunPrompt(value);
  };

  /** Avoids accumulating empty Conversations by focusing the existing empty composer first. */
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
    <section
      data-tutorial="chat-workspace"
      className="flex min-w-0 flex-1 flex-col bg-surface"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-zinc-50/80 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <ConversationSwitcher
            conversations={conversations}
            activeConversationId={conversationId}
            disabled={isLoading}
            onSelect={onSelectConversation}
            onRename={onRenameConversation}
            onDelete={onDeleteConversation}
          />
          {events.length > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
              {timelineEvents.length} events
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
          disabled={!modelConfigured}
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
        onRemove={removePrompt}
      />

      <DebugPanel
        events={timelineEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
      />

      <div className="shrink-0 bg-surface px-3 pb-3 pt-1">
        <form onSubmit={submitComposer}>
          <Input
            handleInputChange={handleInputChange}
            input={input}
            inputRef={composerRef}
            isInitializing={!connectionReady}
            isLoading={isLoading}
            hasQueuedPrompts={queuedPrompts.length > 0}
            modelConfigured={modelConfigured}
            onConfigureApiKey={requestApiConfiguration}
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

/** Memoizes Conversation navigation props while keeping high-frequency AI streaming state local. */
export const ChatWorkspace = memo(
  ChatWorkspaceComponent,
  (previous, next) =>
    previous.sessionId === next.sessionId &&
    previous.conversationId === next.conversationId &&
    previous.conversationRevision === next.conversationRevision &&
    previous.sandboxId === next.sandboxId &&
    previous.modelConfig === next.modelConfig &&
    previous.modelConfigured === next.modelConfigured &&
    previous.connectionReady === next.connectionReady &&
    previous.connectionStatus === next.connectionStatus &&
    previous.runtimeEvents === next.runtimeEvents &&
    previous.selectedEventId === next.selectedEventId &&
    previous.onCreateConversation === next.onCreateConversation &&
    previous.onSelectConversation === next.onSelectConversation &&
    previous.onSelectEvent === next.onSelectEvent &&
    previous.onConversationChange === next.onConversationChange &&
    previous.onQueueChange === next.onQueueChange &&
    previous.onStatusChange === next.onStatusChange &&
    conversationNavigationEqual(previous.conversations, next.conversations),
);
