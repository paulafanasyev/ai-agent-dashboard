/**
 * File: lib/ai/kimi.ts
 * Purpose: Build Kimi, DeepSeek, and custom OpenAI-compatible language models for computer use.
 * Problem solved: Adapts screenshot tool results into multimodal messages that compatible models can inspect.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, type LanguageModelV1Middleware } from "ai";

function screenshotText(
  result: unknown,
  content: Array<{ type: string; text?: string }> | undefined,
) {
  const contentText = content
    ?.filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (contentText) return contentText;
  if (typeof result !== "object" || result === null || !("text" in result)) {
    return "Screenshot captured, but no text observation was available.";
  }
  return typeof result.text === "string"
    ? result.text
    : "Screenshot captured, but no text observation was available.";
}

/** Converts tool screenshots to either visual input or a text observation per provider capability. */
function toolImageMiddleware(supportsVision: boolean): LanguageModelV1Middleware {
  return {
    middlewareVersion: "v1",
    transformParams: async ({ params }) => {
    const prompt: typeof params.prompt = [];

    for (const message of params.prompt) {
      if (message.role === "assistant") {
        const reasoningContent = message.content
          .filter((part) => part.type === "reasoning")
          .map((part) => part.text)
          .join("");
        prompt.push(
          reasoningContent
            ? {
                ...message,
                providerMetadata: {
                  ...message.providerMetadata,
                  openaiCompatible: {
                    ...message.providerMetadata?.openaiCompatible,
                    reasoning_content: reasoningContent,
                  },
                },
              }
            : message,
        );
        continue;
      }

      if (message.role !== "tool") {
        prompt.push(message);
        continue;
      }

      const imageParts = message.content.flatMap((part) =>
        part.content?.filter((content) => content.type === "image") ?? [],
      );

      if (imageParts.length === 0) {
        prompt.push(message);
        continue;
      }

      prompt.push({
        ...message,
        content: message.content.map((part) => ({
          ...part,
          result:
            part.content?.some((content) => content.type === "image") === true
              ? supportsVision
                ? "Screenshot captured and attached in the next user message."
                : screenshotText(part.result, part.content)
              : part.result,
          content: undefined,
        })),
      });
      if (supportsVision) {
        prompt.push({
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: "Current screenshot from the computer tool:",
            },
            ...imageParts.map((part) => ({
              type: "image" as const,
              image: Uint8Array.from(Buffer.from(part.data, "base64")),
              mimeType: part.mimeType ?? "image/png",
            })),
          ],
        });
      }
    }

    return { ...params, prompt };
    },
  };
}

/** Builds a compatible provider model with screenshot-result middleware for visual tool use. */
export function createOpenAICompatibleModel({
  apiKey,
  baseUrl,
  extraBody,
  modelId,
  providerName,
  requestFetch,
  supportsVision = true,
}: {
  apiKey: string;
  baseUrl: string;
  extraBody?: Record<string, unknown>;
  modelId: string;
  providerName: string;
  requestFetch?: typeof globalThis.fetch;
  supportsVision?: boolean;
}) {
  const baseFetch = requestFetch ?? globalThis.fetch;
  const compatibleFetch: typeof globalThis.fetch | undefined = extraBody
    ? (input, init) =>
        baseFetch(input, {
          ...init,
          body: mergeJsonRequestBody(init?.body, extraBody),
        })
    : requestFetch;
  const provider = createOpenAICompatible({
    apiKey,
    baseURL: baseUrl,
    fetch: compatibleFetch,
    name: providerName,
  });

  return wrapLanguageModel({
    model: provider.chatModel(modelId),
    middleware: toolImageMiddleware(supportsVision),
    modelId,
    providerId: providerName,
  });
}

/** Adds provider-specific top-level fields while leaving non-JSON request bodies untouched. */
export function mergeJsonRequestBody(
  body: BodyInit | null | undefined,
  extraBody: Record<string, unknown>,
) {
  if (typeof body !== "string") return body;

  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return body;
    }
    return JSON.stringify({ ...parsed, ...extraBody });
  } catch {
    return body;
  }
}

/** Applies a configured Kimi endpoint while reusing the generic compatible-model adapter. */
export function createKimiModel(
  apiKey: string,
  modelId: string,
  baseUrl: string,
) {
  return createOpenAICompatibleModel({
    apiKey,
    baseUrl,
    modelId,
    providerName: "kimi",
  });
}
