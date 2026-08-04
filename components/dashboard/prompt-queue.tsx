/**
 * File: components/dashboard/prompt-queue.tsx
 * Purpose: Show and manage follow-up tasks waiting for the desktop or current run.
 * Problem solved: Makes FIFO execution explicit while keeping the composer available at all times.
 */
"use client";

import { Clock3, X } from "lucide-react";
import type { QueuedPrompt } from "@/lib/dashboard/types";

interface PromptQueueProps {
  prompts: QueuedPrompt[];
  waitingForDesktop: boolean;
  onRemove: (promptId: string) => void;
}

export function PromptQueue({
  prompts,
  waitingForDesktop,
  onRemove,
}: PromptQueueProps) {
  if (prompts.length === 0) return null;

  return (
    <section
      aria-label="Queued tasks"
      className="mx-3 mb-2 overflow-hidden rounded-lg bg-zinc-50"
    >
      <header className="flex h-8 items-center justify-between px-3">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-600">
          <Clock3 className="size-3 text-amber-500" />
          Queued · {prompts.length}
        </span>
        <span className="text-[9px] text-zinc-400">
          {waitingForDesktop ? "Waiting for Desktop" : "Runs next"}
        </span>
      </header>
      <ol className="max-h-28 space-y-px overflow-y-auto px-1.5 pb-1.5">
        {prompts.map((prompt, index) => (
          <li
            key={prompt.id}
            className="group flex min-h-8 items-center gap-2 rounded-md bg-surface px-2.5 py-1.5"
          >
            <span className="w-3 shrink-0 text-[9px] tabular-nums text-zinc-400">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-700">
              {prompt.text}
            </span>
            <button
              type="button"
              onClick={() => onRemove(prompt.id)}
              aria-label={`Remove queued task ${index + 1}`}
              className="rounded p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
