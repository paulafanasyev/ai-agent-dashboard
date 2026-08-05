/**
 * File: lib/ai/tool-call-repair.ts
 * Purpose: Repair one known OpenAI-compatible computer-tool serialization defect.
 * Problem solved: DeepSeek can embed an XML-style parameter inside an otherwise valid JSON action value.
 */
import type { ToolCallRepairFunction, ToolSet } from "ai";

const COMPUTER_PARAMETER_NAMES = new Set([
  "coordinate",
  "duration",
  "scroll_amount",
  "scroll_direction",
  "start_coordinate",
  "text",
]);

const COMPUTER_ACTION_ALIASES: Record<string, string> = {
  click: "left_click",
  keypress: "key",
  press_key: "key",
};

const EMBEDDED_PARAMETER_PATTERN =
  /^([a-z_]+)["']?>\s*<parameter\s+name=["']([a-z_]+)["']>([\s\S]*?)(?:<\/parameter>)?$/i;

function parseEmbeddedValue(name: string, rawValue: string) {
  const value = rawValue.trim();
  if (
    name === "coordinate" ||
    name === "start_coordinate" ||
    name === "duration" ||
    name === "scroll_amount"
  ) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Repairs only the observed, bounded corruption and lets the original tool schema
 * validate the repaired payload before any action reaches the Sandbox.
 */
export const repairCompatibleToolCall: ToolCallRepairFunction<ToolSet> = async ({
  toolCall,
}) => {
  if (toolCall.toolName !== "computer") return null;

  try {
    const args = JSON.parse(toolCall.args) as unknown;
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      return null;
    }
    const candidate = args as Record<string, unknown>;
    if (typeof candidate.action !== "string") return null;
    const alias = COMPUTER_ACTION_ALIASES[candidate.action];
    if (alias) {
      return {
        ...toolCall,
        args: JSON.stringify({ ...candidate, action: alias }),
      };
    }
    const match = candidate.action.match(EMBEDDED_PARAMETER_PATTERN);
    if (!match) return null;

    const [, rawAction, parameterName, rawValue] = match;
    if (!COMPUTER_PARAMETER_NAMES.has(parameterName)) return null;
    const action = COMPUTER_ACTION_ALIASES[rawAction] ?? rawAction;

    return {
      ...toolCall,
      args: JSON.stringify({
        ...candidate,
        action,
        [parameterName]: parseEmbeddedValue(parameterName, rawValue),
      }),
    };
  } catch {
    return null;
  }
};
