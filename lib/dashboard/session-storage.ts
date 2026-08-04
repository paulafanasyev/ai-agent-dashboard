/**
 * File: lib/dashboard/session-storage.ts
 * Purpose: Create, validate, restore, and persist browser-local dashboard sessions.
 * Problem solved: Preserves conversation history without storing oversized screenshot payloads.
 */
import { z } from "zod";
import type { UIMessage } from "ai";
import { prunedMessages } from "@/lib/utils";
import type {
  ChatConversation,
  ChatSession,
  RuntimeEvent,
  ToolEvent,
} from "./types";

export const SESSION_STORAGE_KEY = "ai-agent-dashboard:sessions:v2";
export const ACTIVE_SESSION_STORAGE_KEY = "ai-agent-dashboard:active-session";
const LEGACY_SESSION_STORAGE_KEY = "ai-agent-dashboard:sessions:v1";

/** Returns the next sequential default Desktop name without colliding with existing names. */
export function getNextDesktopName(existingNames: string[]): string {
  const highestDesktopNumber = existingNames.reduce((highest, name) => {
    const match = /^Desktop (\d+)$/.exec(name.trim());
    if (!match) return highest;
    return Math.max(highest, Number(match[1]));
  }, 0);

  return `Desktop ${Math.max(existingNames.length, highestDesktopNumber) + 1}`;
}

const storedConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  revision: z.number().default(0),
  apiConfigId: z.string().nullable().default(null),
  messages: z.custom<UIMessage[]>((value) => Array.isArray(value)),
  events: z.custom<ToolEvent[]>((value) => Array.isArray(value)),
  queuedPrompts: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        createdAt: z.number(),
      }),
    )
    .default([]),
});

const storedSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  pinned: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  sandboxId: z.string().nullable(),
  generation: z.number(),
  runtimeEvents: z
    .custom<RuntimeEvent[]>((value) => Array.isArray(value))
    .default([]),
  activeConversationId: z.string(),
  conversations: z.array(storedConversationSchema).min(1),
});

const legacySessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  sandboxId: z.string().nullable(),
  generation: z.number(),
  conversationRevision: z.number().default(0),
  messages: z.custom<UIMessage[]>((value) => Array.isArray(value)),
  events: z.custom<ToolEvent[]>((value) => Array.isArray(value)),
});

function restoreMessages(messages: UIMessage[]) {
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt
      ? new Date(String(message.createdAt))
      : undefined,
  }));
}

/** Creates an isolated Conversation record with no messages, events, or queued prompts. */
export function createEmptyConversation(apiConfigId: string | null = null): ChatConversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    revision: 0,
    apiConfigId,
    messages: [],
    events: [],
    queuedPrompts: [],
  };
}

/** Creates one Desktop Session and its required initial Conversation without allocating a Sandbox. */
export function createEmptySession(title = "Desktop session"): ChatSession {
  const now = Date.now();
  const conversation = createEmptyConversation();
  return {
    id: crypto.randomUUID(),
    title,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    sandboxId: null,
    generation: 0,
    connectionStatus: "uninitialized",
    runtimeEvents: [],
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

/**
 * Validates and migrates browser history, revives dates, and always resets connection state.
 * A persisted Ready value is never trusted after page restoration.
 */
export function loadSessions(): ChatSession[] {
  try {
    const stored =
      localStorage.getItem(SESSION_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
    if (!stored) return [];
    const value: unknown = JSON.parse(stored);
    const parsed = z.array(storedSessionSchema).safeParse(value);
    if (parsed.success) {
      return parsed.data.map((session) => {
        const activeConversationId = session.conversations.some(
          (conversation) => conversation.id === session.activeConversationId,
        )
          ? session.activeConversationId
          : session.conversations[0].id;
        return {
          ...session,
          activeConversationId,
          conversations: session.conversations.map((conversation) => ({
            ...conversation,
            messages: restoreMessages(conversation.messages),
          })),
          connectionStatus: "uninitialized" as const,
        };
      });
    }

    const legacy = z.array(legacySessionSchema).safeParse(value);
    if (!legacy.success) return [];

    return legacy.data.map((session, index) => {
      const conversationId = crypto.randomUUID();
      return {
        id: session.id,
        title: `Desktop ${index + 1}`,
        pinned: false,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        sandboxId: session.sandboxId,
        generation: session.generation,
        connectionStatus: "uninitialized" as const,
        runtimeEvents: [],
        activeConversationId: conversationId,
        conversations: [
          {
            id: conversationId,
            title:
              session.title === "New task"
                ? "New conversation"
                : session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            revision: session.conversationRevision,
            apiConfigId: null,
            messages: restoreMessages(session.messages),
            events: session.events,
            queuedPrompts: [],
          },
        ],
      };
    });
  } catch {
    return [];
  }
}

function redactEventImage(event: ToolEvent): ToolEvent {
  if (
    event.kind === "computer" &&
    event.result?.type === "image"
  ) {
    return {
      ...event,
      result: {
        type: "text",
        text: "Screenshot omitted from localStorage",
      },
    };
  }
  return event;
}

/** Persists compact Session history after removing screenshot payloads that could exhaust storage. */
export function persistSessions(sessions: ChatSession[]) {
  const serializable = sessions.map((session) => ({
    ...session,
    connectionStatus: undefined,
    conversations: session.conversations.map((conversation) => ({
      ...conversation,
      messages: prunedMessages(
        conversation.messages.map((message) => ({
          ...message,
          parts: [...message.parts],
        })),
      ),
      events: conversation.events.map(redactEventImage),
    })),
  }));
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable));
}
