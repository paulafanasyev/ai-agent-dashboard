/**
 * File: lib/sandbox/tool.ts
 * Purpose: Bind shared sandbox actions to Anthropic's native computer-use tools.
 * Problem solved: Preserves Claude's native tool protocol while reusing the common execution layer.
 */
import { anthropicProvider } from "@/lib/ai/anthropic";
import {
  executeBashCommand,
  executeComputerAction,
  type ComputerActionResult,
} from "./actions";
import { resolution } from "./config";

function toAnthropicToolResult(result: ComputerActionResult) {
  return result.type === "image"
    ? [{ type: "image" as const, data: result.data, mimeType: "image/png" }]
    : [{ type: "text" as const, text: result.text }];
}

/** Binds shared computer execution to Anthropic's native computer-use schema and result format. */
export const computerTool = (sandboxId: string) =>
  anthropicProvider.tools.computer_20250124({
    displayWidthPx: resolution.x,
    displayHeightPx: resolution.y,
    displayNumber: 1,
    execute: (input) => executeComputerAction(sandboxId, input),
    experimental_toToolResultContent: toAnthropicToolResult,
  });

/** Binds shared shell execution to Anthropic's native Bash tool contract. */
export const bashTool = (sandboxId?: string) =>
  anthropicProvider.tools.bash_20250124({
    execute: ({ command }) => executeBashCommand(sandboxId, command),
  });
