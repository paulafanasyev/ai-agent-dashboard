/**
 * File: components/input.tsx
 * Purpose: Render the chat composer and its submit or stop control.
 * Problem solved: Keeps follow-up input available while tasks wait for the desktop or an active run.
 */
import { ArrowUp } from "lucide-react";
import { Input as ShadcnInput } from "./ui/input";

interface InputProps {
  input: string;
  inputRef?: React.Ref<HTMLInputElement>;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  hasQueuedPrompts: boolean;
  modelConfigured: boolean;
  stop: () => void;
}

export const Input = ({
  input,
  inputRef,
  handleInputChange,
  isInitializing,
  isLoading,
  hasQueuedPrompts,
  modelConfigured,
  stop,
}: InputProps) => {
  const willQueue = isInitializing || isLoading || hasQueuedPrompts;
  const showStop = isLoading && !input.trim();

  return (
    <div className="relative w-full">
      <ShadcnInput
        ref={inputRef}
        className="h-11 w-full rounded-xl border-transparent bg-zinc-100 py-3 pl-4 pr-12 text-sm shadow-none transition-colors focus-visible:border-zinc-300 focus-visible:bg-surface"
        value={input}
        autoFocus
        disabled={!modelConfigured}
        placeholder={
          !modelConfigured
            ? "Configure BYOK in Settings first..."
            : isInitializing
            ? "Queue a task while Desktop starts..."
            : isLoading
              ? "Add a follow-up..."
              : "Give the agent a task..."
        }
        onChange={handleInputChange}
      />
      {showStop ? (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop current task"
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-zinc-300"
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
          title={willQueue ? "Add to queue" : "Send task"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
