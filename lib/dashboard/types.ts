/**
 * File: lib/dashboard/types.ts
 * Purpose: Define discriminated event, status, target, and session data contracts.
 * Problem solved: Gives the dashboard one type-safe vocabulary for agent activity and persistence.
 */
import type { UIMessage } from "ai";

export type AgentStatus = "idle" | "thinking" | "executing";
export type EventStatus = "pending" | "completed" | "error" | "cancelled";
export type ConnectionStatus =
  | "uninitialized"
  | "checking"
  | "creating"
  | "reconnecting"
  | "ready"
  | "offline"
  | "error";

export type ComputerAction =
  | "screenshot"
  | "wait"
  | "left_click"
  | "double_click"
  | "right_click"
  | "middle_click"
  | "triple_click"
  | "mouse_move"
  | "navigate"
  | "type"
  | "key"
  | "scroll"
  | "left_click_drag"
  | "hold_key"
  | "cursor_position"
  | "left_mouse_down"
  | "left_mouse_up"
  | "unknown";

export interface EventBase {
  id: string;
  sessionId: string;
  toolCallId: string;
  timestamp: number;
  durationMs: number | null;
  status: EventStatus;
}

export interface BrowserTarget {
  coordinate?: readonly [number, number];
  confidence: "coordinate-only";
}

export interface ComputerEvent extends EventBase {
  kind: "computer";
  action: ComputerAction;
  payload: {
    coordinate?: readonly [number, number];
    startCoordinate?: readonly [number, number];
    text?: string;
    duration?: number;
    scrollAmount?: number;
    scrollDirection?: string;
    target?: BrowserTarget;
  };
  result?:
    | { type: "image"; data: string }
    | { type: "text"; text: string };
}

export interface BashEvent extends EventBase {
  kind: "bash";
  action: "command";
  payload: { command: string };
  result?: { output: string };
}

export type RuntimeAction =
  | "sandbox_create"
  | "sandbox_reconnect"
  | "sandbox_health_check"
  | "sandbox_destroy"
  | "vnc_connect"
  | "vnc_disconnect";

export interface RuntimeEvent extends EventBase {
  kind: "runtime";
  action: RuntimeAction;
  payload: {
    sandboxId?: string;
    source: "system" | "user" | "viewer";
    message?: string;
  };
  result?: {
    message?: string;
  };
}

export type ToolEvent = ComputerEvent | BashEvent;
export type AgentEvent = ToolEvent | RuntimeEvent;

export interface QueuedPrompt {
  id: string;
  text: string;
  createdAt: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
  apiConfigId: string | null;
  messages: UIMessage[];
  events: ToolEvent[];
  queuedPrompts: QueuedPrompt[];
}

export interface ChatSession {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  sandboxId: string | null;
  generation: number;
  connectionStatus: ConnectionStatus;
  runtimeEvents: RuntimeEvent[];
  activeConversationId: string;
  conversations: ChatConversation[];
}
