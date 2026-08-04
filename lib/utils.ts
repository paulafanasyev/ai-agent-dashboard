/**
 * File: lib/utils.ts
 * Purpose: Provide shared class merging and safe message-pruning utilities.
 * Problem solved: Removes duplicated presentation helpers and prevents unsupported tool content from being resent.
 */
import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

interface PrunedMessageOptions {
  compactPriorToolCalls?: boolean;
  preserveLatestScreenshot?: boolean;
}

function isComputerScreenshot(
  part: UIMessage["parts"][number],
): part is Extract<
  UIMessage["parts"][number],
  { type: "tool-invocation" }
> {
  return (
    part.type === "tool-invocation" &&
    part.toolInvocation.toolName === "computer" &&
    part.toolInvocation.args.action === "screenshot"
  );
}

/**
 * Removes oversized screenshot history and repairs interrupted tool calls before persistence
 * or transport. Only the newest screenshot may be retained for an active tool continuation.
 */
export const prunedMessages = (
  messages: UIMessage[],
  {
    compactPriorToolCalls = false,
    preserveLatestScreenshot = false,
  }: PrunedMessageOptions = {},
): UIMessage[] => {
  const latestUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  let latestScreenshotToolCallId: string | null = null;
  if (preserveLatestScreenshot && messages.at(-1)?.role === "assistant") {
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      const parts = messages[messageIndex].parts;
      for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
        const part = parts[partIndex];
        if (
          isComputerScreenshot(part) &&
          part.toolInvocation.state === "result"
        ) {
          latestScreenshotToolCallId = part.toolInvocation.toolCallId;
          break;
        }
      }
      if (latestScreenshotToolCallId) break;
    }
  }

  return messages.flatMap((message, messageIndex) => {
    const parts: UIMessage["parts"] = [];
    for (const part of message.parts) {
      if (part.type === "tool-invocation") {
        if (compactPriorToolCalls && messageIndex < latestUserIndex) continue;
        if (part.toolInvocation.state !== "result") {
          parts.push({
            ...part,
            toolInvocation: {
              ...part.toolInvocation,
              state: "result" as const,
              result: "Previous tool action was interrupted before completion.",
            },
          });
          continue;
        }
        if (
          isComputerScreenshot(part) &&
          part.toolInvocation.toolCallId !== latestScreenshotToolCallId
        ) {
          parts.push({
            ...part,
            toolInvocation: {
              ...part.toolInvocation,
              result: {
                type: "text",
                text: "Previous screenshot omitted to keep the request compact.",
              },
            },
          });
          continue;
        }
        parts.push(part);
        continue;
      }
      parts.push(part);
    }
    if (parts.length === 0 && message.role === "assistant") return [];
    return [{ ...message, parts }];
  });
};
