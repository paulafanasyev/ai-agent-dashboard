/**
 * File: components/input.tsx
 * Purpose: Render the chat composer and its submit or stop control.
 * Problem solved: Keeps follow-up input available while tasks wait for the desktop or an active run.
 */
import { ArrowUp, ChevronDown } from "lucide-react";
import type { SelectableApiConfig } from "@/lib/ai/model-config";
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
        <div className="absolute bottom-2 right-12 max-w-[calc(100%-4rem)]">
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-400" />
          <select
            aria-label="API configuration for this conversation"
            value={selectedApiConfigId ?? ""}
            onChange={(event) => onSelectApiConfig(event.target.value)}
            disabled={isLoading}
            className="h-7 max-w-[180px] appearance-none truncate rounded-md border border-zinc-200 bg-surface py-1 pl-2 pr-7 text-[10px] font-medium text-zinc-600 outline-none transition-colors hover:border-zinc-300 hover:text-zinc-900 focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
          >
            {apiConfigs.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
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
