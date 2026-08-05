/**
 * File: app/api/chat/route.ts
 * Purpose: Stream model responses and dispatch computer-use tools.
 * Problem solved: Unifies Claude, Kimi, DeepSeek, and custom BYOK requests behind one validated API endpoint.
 */
import { streamText, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";
import {
  anthropicModelId,
  anthropicProvider,
  createAnthropicByokModel,
} from "@/lib/ai/anthropic";
import {
  createKimiModel,
  createOpenAICompatibleModel,
} from "@/lib/ai/kimi";
import { repairCompatibleToolCall } from "@/lib/ai/tool-call-repair";
import {
  DEEPSEEK_BASE_URL,
  deepSeekThinkingMode,
  isSafeCustomBaseUrl,
} from "@/lib/ai/model-config";
import { getServerModelCapabilities } from "@/lib/ai/runtime-policy";
import { checkDesktopHealth } from "@/lib/sandbox/utils";
import { bashTool, computerTool } from "@/lib/sandbox/tool";
import {
  genericBashTool,
  genericComputerTool,
} from "@/lib/sandbox/generic-tool";
import { prunedMessages } from "@/lib/utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 300;

const modelConfigSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("anthropic") }),
  z.object({
    provider: z.literal("anthropic-byok"),
    apiKey: z.string().trim().min(8).max(512),
    modelId: z.string().trim().min(1).max(200),
  }),
  z.object({
    provider: z.literal("kimi"),
    apiKey: z.string().trim().min(8).max(512),
    modelId: z.string().trim().min(1).max(200),
    reasoningEffort: z.enum(["low", "high", "max"]),
  }),
  z.object({
    provider: z.literal("deepseek"),
    apiKey: z.string().trim().min(8).max(512),
    modelId: z.string().trim().min(1).max(200),
    thinkingMode: z.enum(["disabled", "enabled"]).default("disabled"),
  }),
  z.object({
    provider: z.literal("custom"),
    apiKey: z.string().trim().min(8).max(512),
    baseUrl: z.string().trim().max(2048).refine(isSafeCustomBaseUrl),
    modelId: z.string().trim().min(1).max(200),
  }),
]);

const chatRequestSchema = z.object({
  messages: z.custom<UIMessage[]>((value) => Array.isArray(value)),
  sandboxId: z.string().min(1),
  desktopReady: z.literal(true),
  modelConfig: modelConfigSchema.default({ provider: "anthropic" }),
});

/**
 * Validates one chat turn, rechecks Desktop readiness, selects the provider/tool protocol,
 * and returns the AI SDK data stream. The server repeats security checks even when the UI
 * already disabled an unsupported model or reported the Desktop as Ready.
 */
export async function POST(req: Request) {
  let sandboxId: string | undefined;

  try {
    const request = chatRequestSchema.parse(await req.json());
    sandboxId = request.sandboxId;
    const { messages, modelConfig } = request;
    if (
      modelConfig.provider === "anthropic" &&
      !getServerModelCapabilities().projectClaudeAvailable
    ) {
      return new Response(
        JSON.stringify({
          error: "Project Claude is local-development only. Configure BYOK in Settings.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // The browser already proves the external noVNC/RFB route before it marks the
    // Desktop Ready. A second external RFB client here can contend with that retained
    // viewer and produce a false 409, so tool dispatch only rechecks the Sandbox-local
    // VNC and noVNC services.
    if (!(await checkDesktopHealth(sandboxId, false))) {
      return new Response(
        JSON.stringify({ error: "Desktop is not ready. The task remains queued." }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const usesGenericTools =
      modelConfig.provider !== "anthropic" &&
      modelConfig.provider !== "anthropic-byok";
    const configuredDeepSeekThinking = deepSeekThinkingMode(modelConfig);

    const model =
      modelConfig.provider === "kimi"
        ? createKimiModel(modelConfig.apiKey, modelConfig.modelId)
        : modelConfig.provider === "anthropic-byok"
          ? createAnthropicByokModel(modelConfig.apiKey, modelConfig.modelId)
        : modelConfig.provider === "deepseek"
          ? createOpenAICompatibleModel({
              apiKey: modelConfig.apiKey,
              baseUrl: DEEPSEEK_BASE_URL,
              extraBody: {
                thinking: { type: modelConfig.thinkingMode },
              },
              modelId: modelConfig.modelId,
              providerName: "deepseek",
              supportsVision: false,
            })
        : modelConfig.provider === "custom"
          ? createOpenAICompatibleModel({
              apiKey: modelConfig.apiKey,
              baseUrl: modelConfig.baseUrl,
              extraBody: configuredDeepSeekThinking
                ? {
                    thinking: { type: configuredDeepSeekThinking },
                  }
                : undefined,
              modelId: modelConfig.modelId,
              providerName: "custom",
              supportsVision: !configuredDeepSeekThinking,
            })
          : anthropicProvider(anthropicModelId);

    const tools: ToolSet = usesGenericTools
      ? {
          computer: genericComputerTool(sandboxId, {
            includeScreenText: configuredDeepSeekThinking !== null,
          }),
          bash: genericBashTool(sandboxId),
        }
      : {
          computer: computerTool(sandboxId),
          bash: bashTool(sandboxId),
        };

    const result = streamText({
      model,
      maxSteps: 30,
      temperature: modelConfig.provider === "kimi" ? 1 : undefined,
      system:
        "You are a helpful assistant operating an observable remote desktop. " +
        "For every task involving a website, browser navigation, web search, page content, forms, or any visual interface, you MUST use the computer tool to operate the visible Chrome window. Take a screenshot before the first visual action and after navigation or any major visual change. Never replace visible browser interaction with curl, wget, a headless browser, or a Bash-based web request. " +
        "Weather, forecasts, news, prices, latest information, and requests to look something up are web tasks. Never answer them from memory. For weather tasks, first visibly navigate to the lightweight page https://wttr.in/<URL-encoded-city>?format=3; if it is unavailable, use another reliable weather site. For the canonical Dubai weather task, open https://wttr.in/Dubai?format=3 in Chrome, read the current result from the page, and only then summarize it for the user. " +
        "For text-only models, screenshot tool results contain a text observation of the same visible Chrome page, including visible controls and coordinates; use that observation exactly as you would inspect the screenshot. Use the computer navigate action for every browser URL or address-bar search, then wait and take another screenshot. " +
        "Use the bash tool only for background work that has no meaningful visual interaction, such as filesystem operations, source inspection, or running local commands. " +
        "Be sure to advise the user when waiting is necessary. " +
        "If the browser opens with a setup wizard, YOU MUST IGNORE IT and move straight to the next step (e.g. input the url in the search bar).",
      messages: prunedMessages(messages, {
        compactPriorToolCalls: true,
        preserveLatestScreenshot: true,
      }),
      tools,
      experimental_repairToolCall: usesGenericTools
        ? repairCompatibleToolCall
        : undefined,
      // Server-side multi-step execution needs the model to stop calling tools and
      // return final text. DeepSeek Thinking mode rejects tool_choice entirely.
      toolChoice:
        configuredDeepSeekThinking === "enabled" ? undefined : "auto",
      providerOptions: modelConfig.provider === "kimi"
        ? {
            kimi: {
              reasoning_effort:
                messages.at(-1)?.role === "assistant" &&
                /^k3(?:-|$)/i.test(modelConfig.modelId)
                  ? "none"
                  : modelConfig.reasoningEffort,
            },
          }
        : modelConfig.provider === "anthropic" ||
            modelConfig.provider === "anthropic-byok"
          ? { anthropic: { cacheControl: { type: "ephemeral" } } }
          : undefined,
    });

    // Create response stream
    const response = result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error(error);
        return error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    const isInvalidRequest = error instanceof z.ZodError;
    return new Response(
      JSON.stringify({
        error: isInvalidRequest
          ? "Invalid chat configuration"
          : "Internal Server Error",
      }),
      {
        status: isInvalidRequest ? 400 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
