/**
 * File: tests/unit/events.test.ts
 * Purpose: Verify tool and runtime event projection, timing, identity, and chronological merging.
 * Problem solved: Protects the typed observability pipeline from lifecycle regressions.
 */

import { describe, expect, it, vi } from "vitest";
import {
  eventCounts,
  finishRuntimeEvent,
  mergeEventTimeline,
  startRuntimeEvent,
  syncAgentEvents,
} from "@/lib/dashboard/events";
import type { UIMessage } from "ai";

describe("dashboard event pipeline", () => {
  it("preserves tool identity and start time across streamed lifecycle updates", () => {
    const pendingMessage = toolMessage("call-1", "call", undefined);
    const pending = syncAgentEvents("conversation-1", [], [pendingMessage], 1000);

    expect(pending).toMatchObject([
      {
        toolCallId: "call-1",
        status: "pending",
        timestamp: 1000,
        durationMs: null,
        kind: "computer",
        action: "left_click",
      },
    ]);

    const completedMessage = toolMessage("call-1", "result", {
      type: "text",
      text: "clicked",
    });
    const completed = syncAgentEvents(
      "conversation-1",
      pending,
      [completedMessage],
      1375,
    );

    expect(completed[0]).toMatchObject({
      toolCallId: "call-1",
      status: "completed",
      timestamp: 1000,
      durationMs: 375,
      result: { type: "text", text: "clicked" },
    });
  });

  it("merges runtime and tool events into a stable chronological timeline", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "runtime-1" });
    const started = startRuntimeEvent(
      "desktop-1",
      "sandbox_create",
      { source: "system" },
      500,
    );
    const finished = finishRuntimeEvent(
      started,
      "completed",
      { message: "ready" },
      750,
    );
    const toolEvents = syncAgentEvents(
      "conversation-1",
      [],
      [toolMessage("call-2", "call", undefined)],
      900,
    );

    const timeline = mergeEventTimeline(toolEvents, [finished]);
    expect(timeline.map((event) => event.id)).toEqual([
      "runtime-1",
      "call-2",
    ]);
    expect(eventCounts(timeline)).toEqual({ sandbox_create: 1, left_click: 1 });
    expect(finished.durationMs).toBe(250);
  });
});

function toolMessage(
  toolCallId: string,
  state: "call" | "result",
  result: unknown,
): UIMessage {
  return {
    id: "message-1",
    role: "assistant",
    content: "",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation:
          state === "call"
            ? {
                state,
                toolCallId,
                toolName: "computer",
                args: { action: "left_click", coordinate: [12, 24] },
              }
            : {
                state,
                toolCallId,
                toolName: "computer",
                args: { action: "left_click", coordinate: [12, 24] },
                result,
              },
      },
    ],
  };
}
