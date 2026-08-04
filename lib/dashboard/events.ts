/**
 * File: lib/dashboard/events.ts
 * Purpose: Normalize AI SDK tool invocations and derive observable agent state.
 * Problem solved: Converts streamed message parts into ordered, typed events, metrics, and status indicators.
 */
import type { UIMessage } from "ai";
import { ABORTED } from "@/lib/utils";
import type {
  AgentEvent,
  AgentStatus,
  ComputerAction,
  EventStatus,
  RuntimeAction,
  RuntimeEvent,
  ToolEvent,
} from "./types";

const computerActions = new Set<ComputerAction>([
  "screenshot",
  "wait",
  "left_click",
  "double_click",
  "right_click",
  "middle_click",
  "triple_click",
  "mouse_move",
  "type",
  "key",
  "scroll",
  "left_click_drag",
  "hold_key",
  "cursor_position",
  "left_mouse_down",
  "left_mouse_up",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function readNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "number" ? record[key] : undefined;
}

function readCoordinate(
  record: Record<string, unknown>,
  key: string,
): readonly [number, number] | undefined {
  const value = record[key];
  return Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
    ? [value[0], value[1]]
    : undefined;
}

function coordinatesEqual(
  first: readonly [number, number] | undefined,
  second: readonly [number, number] | undefined,
) {
  return (
    first === second ||
    (first?.[0] === second?.[0] && first?.[1] === second?.[1])
  );
}

function pendingInvocationMatches(
  event: AgentEvent,
  toolName: string,
  args: Record<string, unknown>,
) {
  if (event.status !== "pending") return false;
  if (toolName === "bash") {
    return (
      event.kind === "bash" &&
      event.payload.command === (readString(args, "command") ?? "")
    );
  }
  if (toolName !== "computer" || event.kind !== "computer") return false;
  const rawAction = readString(args, "action") ?? "unknown";
  const action = computerActions.has(rawAction as ComputerAction)
    ? (rawAction as ComputerAction)
    : "unknown";
  return (
    event.action === action &&
    coordinatesEqual(
      event.payload.coordinate,
      readCoordinate(args, "coordinate"),
    ) &&
    coordinatesEqual(
      event.payload.startCoordinate,
      readCoordinate(args, "start_coordinate"),
    ) &&
    event.payload.text === readString(args, "text") &&
    event.payload.duration === readNumber(args, "duration") &&
    event.payload.scrollAmount === readNumber(args, "scroll_amount") &&
    event.payload.scrollDirection === readString(args, "scroll_direction")
  );
}

function eventStatus(state: string, result: unknown): EventStatus {
  if (state !== "result") return "pending";
  if (result === ABORTED) return "cancelled";
  if (
    typeof result === "string" &&
    result.toLowerCase().startsWith("error")
  ) {
    return "error";
  }
  return "completed";
}

export function syncAgentEvents(
  sessionId: string,
  existingEvents: ToolEvent[],
  messages: UIMessage[],
  now = Date.now(),
): ToolEvent[] {
  const existingById = new Map(
    existingEvents.map((event) => [event.toolCallId, event]),
  );
  const nextById = new Map(existingById);
  let changed = false;

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-invocation") continue;

      const invocation = part.toolInvocation;
      const previous = existingById.get(invocation.toolCallId);
      const rawArgs: unknown = invocation.args;
      const args = isRecord(rawArgs) ? rawArgs : {};
      const nextStatus = eventStatus(
        invocation.state,
        invocation.state === "result" ? invocation.result : undefined,
      );
      if (
        previous &&
        (previous.status !== "pending" ||
          (nextStatus === "pending" &&
            pendingInvocationMatches(previous, invocation.toolName, args)))
      ) {
        continue;
      }
      const result: unknown =
        invocation.state === "result" ? invocation.result : undefined;
      const status = nextStatus;
      const timestamp = previous?.timestamp ?? now;
      const durationMs =
        status === "pending"
          ? null
          : previous?.durationMs ?? Math.max(0, now - timestamp);

      if (invocation.toolName === "bash") {
        changed = true;
        nextById.set(invocation.toolCallId, {
          id: invocation.toolCallId,
          toolCallId: invocation.toolCallId,
          sessionId,
          kind: "bash",
          action: "command",
          payload: { command: readString(args, "command") ?? "" },
          result:
            typeof result === "string" ? { output: result } : undefined,
          timestamp,
          durationMs,
          status,
        });
        continue;
      }

      if (invocation.toolName === "computer") {
        changed = true;
        const rawAction = readString(args, "action") ?? "unknown";
        const action = computerActions.has(rawAction as ComputerAction)
          ? (rawAction as ComputerAction)
          : "unknown";
        const coordinate = readCoordinate(args, "coordinate");
        const normalizedResult = isRecord(result)
          ? result.type === "image" && typeof result.data === "string"
            ? ({ type: "image", data: result.data } as const)
            : result.type === "text" && typeof result.text === "string"
              ? ({ type: "text", text: result.text } as const)
              : undefined
          : undefined;

        nextById.set(invocation.toolCallId, {
          id: invocation.toolCallId,
          toolCallId: invocation.toolCallId,
          sessionId,
          kind: "computer",
          action,
          payload: {
            coordinate,
            startCoordinate: readCoordinate(args, "start_coordinate"),
            text: readString(args, "text"),
            duration: readNumber(args, "duration"),
            scrollAmount: readNumber(args, "scroll_amount"),
            scrollDirection: readString(args, "scroll_direction"),
            target: coordinate
              ? { coordinate, confidence: "coordinate-only" }
              : undefined,
          },
          result: normalizedResult,
          timestamp,
          durationMs,
          status,
        });
      }
    }
  }

  if (!changed) return existingEvents;
  return [...nextById.values()].sort(
    (first, second) => first.timestamp - second.timestamp,
  );
}

export function deriveAgentStatus(
  chatStatus: "error" | "submitted" | "streaming" | "ready",
  events: ToolEvent[],
): AgentStatus {
  if (events.some((event) => event.status === "pending")) return "executing";
  if (chatStatus === "submitted" || chatStatus === "streaming") {
    return "thinking";
  }
  return "idle";
}

export function eventCounts(events: AgentEvent[]) {
  return events.reduce<Record<string, number>>((counts, event) => {
    const key = event.kind === "bash" ? "bash" : event.action;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function eventLabel(event: AgentEvent) {
  if (event.kind === "bash") return "Bash command";
  if (event.kind === "runtime") {
    return event.action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return event.action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function startRuntimeEvent(
  sessionId: string,
  action: RuntimeAction,
  payload: RuntimeEvent["payload"],
  now = Date.now(),
): RuntimeEvent {
  const id = crypto.randomUUID();
  return {
    id,
    toolCallId: id,
    sessionId,
    kind: "runtime",
    action,
    payload,
    timestamp: now,
    durationMs: null,
    status: "pending",
  };
}

export function finishRuntimeEvent(
  event: RuntimeEvent,
  status: Exclude<EventStatus, "pending">,
  result?: RuntimeEvent["result"],
  now = Date.now(),
): RuntimeEvent {
  return {
    ...event,
    status,
    result,
    durationMs: Math.max(0, now - event.timestamp),
  };
}

export function mergeEventTimeline(
  toolEvents: ToolEvent[],
  runtimeEvents: RuntimeEvent[],
) {
  return [...toolEvents, ...runtimeEvents].sort(
    (first, second) => first.timestamp - second.timestamp,
  );
}
