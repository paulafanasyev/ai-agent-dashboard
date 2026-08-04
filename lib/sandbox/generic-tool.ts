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

export const genericComputerTool = (sandboxId: string) =>
  tool({
    description:
      "Operate a 1024x768 Linux desktop. Take a screenshot before deciding where to click, then take another screenshot after navigation or any major visual change.",
    parameters: computerInputSchema,
    execute: (input) => executeComputerAction(sandboxId, input),
    experimental_toToolResultContent(result) {
      return result.type === "image"
        ? [{ type: "image", data: result.data, mimeType: "image/png" }]
        : [{ type: "text", text: result.text }];
    },
  });

export const genericBashTool = (sandboxId?: string) =>
  tool({
    description:
      "Run a background shell command inside the remote Linux desktop for non-visual work such as file operations and source inspection. Never use this tool for website navigation, web search, page reading, forms, or other browser interactions; use the computer tool so the user can observe them.",
    parameters: z.object({
      command: z.string().min(1).describe("The shell command to execute."),
    }),
    execute: ({ command }) => executeBashCommand(sandboxId, command),
  });
