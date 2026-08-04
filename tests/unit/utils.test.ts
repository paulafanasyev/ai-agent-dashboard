/**
 * File: tests/unit/utils.test.ts
 * Purpose: Verify safe message transport compaction and interrupted tool recovery.
 * Problem solved: Prevents screenshot-heavy Conversations from exceeding request limits.
 */

import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { prunedMessages } from "@/lib/utils";

function screenshotMessage(id: string, data: string): UIMessage {
  return {
    id,
    role: "assistant",
    content: "",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          toolCallId: id,
          toolName: "computer",
          args: { action: "screenshot" },
          result: { type: "image", data },
        },
      },
    ],
  };
}

describe("pruned messages", () => {
  it("keeps only the newest screenshot for an active tool continuation", () => {
    const messages = [
      screenshotMessage("older", "old-image"),
      screenshotMessage("newest", "new-image"),
    ];

    const pruned = prunedMessages(messages, {
      preserveLatestScreenshot: true,
    });
    const olderPart = pruned[0].parts[0];
    const newestPart = pruned[1].parts[0];

    expect(olderPart).toMatchObject({
      toolInvocation: {
        result: { type: "text" },
      },
    });
    expect(newestPart).toMatchObject({
      toolInvocation: {
        result: { type: "image", data: "new-image" },
      },
    });
    expect(messages[0]).toMatchObject({
      parts: [{ toolInvocation: { result: { data: "old-image" } } }],
    });
  });

  it("redacts every screenshot for persistence", () => {
    const pruned = prunedMessages([screenshotMessage("latest", "image")]);
    expect(pruned[0].parts[0]).toMatchObject({
      toolInvocation: { result: { type: "text" } },
    });
  });

  it("repairs an interrupted tool call before it is reused", () => {
    const message: UIMessage = {
      id: "assistant-call",
      role: "assistant",
      content: "",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            state: "call",
            toolCallId: "call-1",
            toolName: "computer",
            args: { action: "left_click", coordinate: [10, 20] },
          },
        },
      ],
    };

    expect(prunedMessages([message])[0].parts[0]).toMatchObject({
      toolInvocation: {
        state: "result",
        result: "Previous tool action was interrupted before completion.",
      },
    });
  });

  it("removes prior-turn tool traces while preserving assistant text", () => {
    const priorScreenshot = screenshotMessage("prior", "old-image");
    priorScreenshot.parts.unshift({ type: "text", text: "Earlier result" });
    const currentUser: UIMessage = {
      id: "current-user",
      role: "user",
      content: "Try again",
      parts: [{ type: "text", text: "Try again" }],
    };

    const pruned = prunedMessages([priorScreenshot, currentUser], {
      compactPriorToolCalls: true,
      preserveLatestScreenshot: true,
    });

    expect(pruned[0].parts).toEqual([
      { type: "text", text: "Earlier result" },
    ]);
    expect(pruned[1]).toEqual(currentUser);
  });
});
