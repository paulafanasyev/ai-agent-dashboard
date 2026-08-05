/**
 * File: tests/unit/openai-compatible.test.ts
 * Purpose: Verify provider-specific fields are injected into compatible API requests.
 * Problem solved: Ensures the DeepSeek thinking toggle changes the real JSON body, not only UI state.
 */

import { describe, expect, it, vi } from "vitest";
import { generateText, tool } from "ai";
import { z } from "zod";
import {
  createOpenAICompatibleModel,
  mergeJsonRequestBody,
} from "@/lib/ai/kimi";

describe("OpenAI-compatible request body", () => {
  it("adds the selected DeepSeek thinking mode and preserves existing fields", () => {
    const body = mergeJsonRequestBody(
      JSON.stringify({ model: "deepseek-v4-pro", stream: true }),
      { thinking: { type: "disabled" } },
    );

    expect(JSON.parse(String(body))).toEqual({
      model: "deepseek-v4-pro",
      stream: true,
      thinking: { type: "disabled" },
    });
  });

  it("leaves non-JSON bodies untouched", () => {
    expect(
      mergeJsonRequestBody("not-json", {
        thinking: { type: "enabled" },
      }),
    ).toBe("not-json");
  });

  it("replays DeepSeek reasoning_content after a tool call", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const requestFetch = vi.fn<typeof fetch>(async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      const firstRequest = requestBodies.length === 1;
      return Response.json({
        id: firstRequest ? "response-tool" : "response-final",
        model: "deepseek-v4-pro",
        choices: [
          {
            index: 0,
            finish_reason: firstRequest ? "tool_calls" : "stop",
            message: firstRequest
              ? {
                  role: "assistant",
                  content: "",
                  reasoning_content: "I should inspect the visible Desktop.",
                  tool_calls: [
                    {
                      id: "call_desktop",
                      type: "function",
                      function: { name: "computer", arguments: "{}" },
                    },
                  ],
                }
              : { role: "assistant", content: "Done." },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });
    const model = createOpenAICompatibleModel({
      apiKey: "sk-deepseek-test",
      baseUrl: "https://api.deepseek.com",
      extraBody: { thinking: { type: "enabled" } },
      modelId: "deepseek-v4-pro",
      providerName: "deepseek",
      requestFetch,
    });

    await generateText({
      model,
      prompt: "Check the Desktop",
      maxSteps: 2,
      tools: {
        computer: tool({
          parameters: z.object({}),
          execute: async () => "Desktop inspected",
        }),
      },
    });

    expect(requestFetch).toHaveBeenCalledTimes(2);
    expect(requestBodies[0]).toMatchObject({
      thinking: { type: "enabled" },
    });
    expect(requestBodies[1]).toMatchObject({
      thinking: { type: "enabled" },
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "",
          reasoning_content: "I should inspect the visible Desktop.",
          tool_calls: expect.any(Array),
        }),
      ]),
    });
  });

  it("maps Kimi reasoning effort through the compatible provider", async () => {
    let requestBody: Record<string, unknown> | null = null;
    const model = createOpenAICompatibleModel({
      apiKey: "sk-kimi-test",
      baseUrl: "https://api.kimi.com/coding/v1",
      modelId: "k3",
      providerName: "kimi",
      requestFetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          id: "response-kimi",
          model: "k3",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: "Done." },
            },
          ],
          usage: { prompt_tokens: 4, completion_tokens: 2 },
        });
      },
    });

    await generateText({
      model,
      prompt: "Hello",
      providerOptions: { kimi: { reasoning_effort: "high" } },
    });

    expect(requestBody).toMatchObject({ reasoning_effort: "high" });
  });
});
