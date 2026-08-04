/**
 * File: lib/ai/kimi.ts
 * Purpose: Build Kimi and custom OpenAI-compatible language models for computer use.
 * Problem solved: Adapts screenshot tool results into multimodal messages that compatible models can inspect.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModelV1Middleware } from "ai";
import { KIMI_BASE_URL } from "./model-config";

const exposeToolImagesToModel: LanguageModelV1Middleware = {
  middlewareVersion: "v1",
  transformParams: async ({ params }) => {
    const prompt: typeof params.prompt = [];

    for (const message of params.prompt) {
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

      prompt.push(
        {
          ...message,
          content: message.content.map((part) => ({
            ...part,
            result:
              part.content?.some((content) => content.type === "image") === true
                ? "Screenshot captured and attached in the next user message."
                : part.result,
            content: undefined,
          })),
        },
        {
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
        },
      );
    }

    return { ...params, prompt };
  },
};

export function createOpenAICompatibleModel({
  apiKey,
  baseUrl,
  modelId,
  providerName,
}: {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  providerName: string;
}) {
  const provider = createOpenAI({
    apiKey,
    baseURL: baseUrl,
    compatibility: "compatible",
    name: providerName,
  });

  return wrapLanguageModel({
    model: provider.chat(modelId),
    middleware: exposeToolImagesToModel,
    modelId,
    providerId: providerName,
  });
}

export function createKimiModel(apiKey: string, modelId: string) {
  return createOpenAICompatibleModel({
    apiKey,
    baseUrl: KIMI_BASE_URL,
    modelId,
    providerName: "kimi",
  });
}
