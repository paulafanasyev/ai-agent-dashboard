/**
 * File: components/input.tsx
 * Purpose: Render the chat composer and its submit or stop control.
 * Problem solved: Keeps follow-up input available while tasks wait for the desktop or an active run.
 */
"use client";

import { ArrowUp, Check, ChevronDown, KeyRound } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  modelProviderLabel,
  type SelectableApiConfig,
} from "@/lib/ai/model-config";
import { cn } from "@/lib/utils";
import { Input as ShadcnInput } from "./ui/input";

interface InputProps {
  input: string;
  inputRef?: React.Ref<HTMLInputElement>;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  hasQueuedPrompts: boolean;
  modelConfigured: boolean;
  apiConfigs: SelectableApiConfig[];
  selectedApiConfigId: string | null;
  onSelectApiConfig: (profileId: string) => void;
  onConfigureApiKey: () => void;
  stop: () => void;
}

/** Keeps the composer actionable for immediate runs, queued follow-ups, stop, or API configuration. */
export const Input = ({
  input,
  inputRef,
  handleInputChange,
  isInitializing,
  isLoading,
  hasQueuedPrompts,
  modelConfigured,
  apiConfigs,
  selectedApiConfigId,
  onSelectApiConfig,
  onConfigureApiKey,
  stop,
}: InputProps) => {
  const willQueue = isInitializing || isLoading || hasQueuedPrompts;
  const showStop = isLoading && !input.trim();
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const selectedModelRef = useRef<HTMLButtonElement>(null);
  const selectedProfile = apiConfigs.find(
    (profile) => profile.id === selectedApiConfigId,
  );

  useEffect(() => {
    if (!modelMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setModelMenuOpen(false);
    };
    const frame = window.requestAnimationFrame(() =>
      selectedModelRef.current?.focus(),
    );
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [modelMenuOpen]);

  const moveModelFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    );
    const currentIndex = options.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div className="relative w-full">
      {!modelConfigured ? (
        <button
          type="button"
          onClick={onConfigureApiKey}
          className="flex h-11 w-full items-center rounded-xl border border-transparent bg-zinc-100 px-4 text-left text-sm text-zinc-500 shadow-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          Configure API key
        </button>
      ) : (
        <ShadcnInput
          ref={inputRef}
          className="h-[76px] w-full rounded-xl border-transparent bg-zinc-100 pb-10 pl-4 pr-4 pt-3 text-sm shadow-none transition-colors focus-visible:border-zinc-300 focus-visible:bg-surface"
          value={input}
          autoFocus
          placeholder={
            isInitializing
            ? "Queue a task while Desktop starts..."
            : isLoading
              ? "Add a follow-up..."
              : "Give the agent a task..."
          }
          onChange={handleInputChange}
        />
      )}
      {modelConfigured ? (
        <div
          ref={modelMenuRef}
          className="absolute bottom-2 right-12 max-w-[calc(100%-4rem)]"
        >
          <button
            type="button"
            aria-label="Choose model"
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            onClick={() => setModelMenuOpen((current) => !current)}
            disabled={isLoading}
            className="flex h-7 max-w-[190px] items-center gap-1.5 rounded-md border border-zinc-200 bg-surface py-1 pl-2 pr-1.5 text-[10px] font-medium text-zinc-600 outline-none transition-colors hover:border-zinc-300 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate font-mono">
              {selectedProfile?.name ?? "Choose model"}
            </span>
            <ChevronDown
              className={cn(
                "size-3 shrink-0 text-zinc-400 transition-transform",
                modelMenuOpen && "rotate-180",
              )}
            />
          </button>

          {modelMenuOpen ? (
            <div
              role="listbox"
              aria-label="Models"
              onKeyDown={moveModelFocus}
              className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-surface p-1.5 shadow-2xl"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[10px] font-semibold text-zinc-500">
                  Model
                </span>
                <span className="text-[9px] tabular-nums text-zinc-400">
                  {apiConfigs.length}
                </span>
              </div>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {apiConfigs.map((profile) => {
                  const selected = profile.id === selectedApiConfigId;
                  return (
                    <button
                      ref={selected ? selectedModelRef : undefined}
                      key={profile.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setModelMenuOpen(false);
                        if (!selected) onSelectApiConfig(profile.id);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-100",
                        selected && "bg-zinc-100",
                      )}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <KeyRound className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[11px] font-semibold text-zinc-800">
                          {profile.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] text-zinc-400">
                          {profile.builtIn
                            ? "Built in"
                            : modelProviderLabel(profile.config)}
                        </span>
                      </span>
                      {selected ? (
                        <Check className="size-3.5 shrink-0 text-violet-500" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {showStop ? (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop current task"
          className="absolute bottom-2 right-2 cursor-pointer rounded-lg bg-primary p-1.5 text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <div className="animate-spin h-4 w-4">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </button>
      ) : (
        <button
          type="submit"
          disabled={!modelConfigured || !input.trim()}
          aria-label={willQueue ? "Queue task" : "Send task"}
          className="absolute bottom-2 right-2 rounded-lg bg-primary p-1.5 text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
