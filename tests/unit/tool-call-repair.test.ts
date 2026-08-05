/**
 * File: tests/unit/tool-call-repair.test.ts
 * Purpose: Verify bounded recovery from malformed compatible-provider tool arguments.
 * Problem solved: Prevents a DeepSeek XML-style parameter fragment from aborting a valid Desktop action.
 */
import { describe, expect, it } from "vitest";
import { repairCompatibleToolCall } from "@/lib/ai/tool-call-repair";

const repair = (args: string) =>
  repairCompatibleToolCall({
    system: undefined,
    messages: [],
    toolCall: {
      toolCallType: "function",
      toolCallId: "call-1",
      toolName: "computer",
      args,
    },
    tools: {},
    parameterSchema: () => ({}),
    error: new Error("invalid arguments") as never,
  });

describe("repairCompatibleToolCall", () => {
  it("extracts an embedded text parameter from the action value", async () => {
    const repaired = await repair(
      JSON.stringify({
        action: 'type">\n<parameter name="text">weather.com',
      }),
    );

    expect(repaired).not.toBeNull();
    expect(JSON.parse(repaired?.args ?? "{}")).toEqual({
      action: "type",
      text: "weather.com",
    });
  });

  it("parses coordinate parameters but refuses unknown parameter names", async () => {
    const repaired = await repair(
      JSON.stringify({
        action:
          'left_click">\n<parameter name="coordinate">[512, 80]</parameter>',
      }),
    );
    expect(JSON.parse(repaired?.args ?? "{}")).toEqual({
      action: "left_click",
      coordinate: [512, 80],
    });

    await expect(
      repair(
        JSON.stringify({
          action: 'type">\n<parameter name="command">unsafe',
        }),
      ),
    ).resolves.toBeNull();
  });

  it("does not alter valid or unrelated tool calls", async () => {
    await expect(
      repair(JSON.stringify({ action: "screenshot" })),
    ).resolves.toBeNull();
  });

  it("normalizes a bounded set of compatible action aliases", async () => {
    const repaired = await repair(
      JSON.stringify({ action: "click", coordinate: [453, 36] }),
    );

    expect(JSON.parse(repaired?.args ?? "{}")).toEqual({
      action: "left_click",
      coordinate: [453, 36],
    });
  });
});
