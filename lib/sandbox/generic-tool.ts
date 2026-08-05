/**
 * File: lib/sandbox/generic-tool.ts
 * Purpose: Expose provider-neutral computer and Bash tools to OpenAI-compatible models.
 * Problem solved: Gives Kimi and custom BYOK models the same sandbox capabilities as Claude.
 */
import { tool } from "ai";
import { z } from "zod";
import {
  computerInputSchema,
  executeBashCommand,
  executeComputerAction,
} from "./actions";

/** Wraps shared computer actions and optionally adds a text observation for text-only models. */
export const genericComputerTool = (
  sandboxId: string,
  { includeScreenText = false }: { includeScreenText?: boolean } = {},
) =>
  tool({
    description:
      "Operate a 1024x768 Linux desktop. Take a screenshot before deciding where to click, then take another screenshot after navigation or any major visual change. To open a URL or search from the browser address bar, always use the navigate action with the URL or search query in text; do not use type for the address bar. Screenshot results include a text observation when the selected model is text-only. The wait action defaults to one second when duration is omitted.",
    parameters: computerInputSchema,
    execute: (input) =>
      executeComputerAction(sandboxId, input, { includeScreenText }),
    experimental_toToolResultContent(result) {
      return result.type === "image"
        ? [
            { type: "image" as const, data: result.data, mimeType: "image/png" },
            ...(result.text
              ? [{ type: "text" as const, text: result.text }]
              : []),
          ]
        : [{ type: "text", text: result.text }];
    },
  });

/** Wraps shared shell execution in a provider-neutral AI SDK function tool. */
export const genericBashTool = (sandboxId?: string) =>
  tool({
    description:
      "Run a background shell command inside the remote Linux desktop for non-visual work such as file operations and source inspection. Never use this tool for website navigation, web search, page reading, forms, or other browser interactions; use the computer tool so the user can observe them.",
    parameters: z.object({
      command: z.string().min(1).describe("The shell command to execute."),
    }),
    execute: ({ command }) => executeBashCommand(sandboxId, command),
  });
