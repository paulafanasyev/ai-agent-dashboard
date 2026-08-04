/**
 * File: components/prompt-suggestions.tsx
 * Purpose: Offer editable prompt presets for common computer-use tasks.
 * Problem solved: Helps users discover agent capabilities while keeping final review and submission under user control.
 */
import { Button } from "./ui/button";

const suggestions = [
  {
    text: "What's the weather in Dubai?",
    prompt: "What's the weather in Dubai?",
  },
  {
    text: "Create notes.txt",
    prompt: "Open a text editor and create a new file called notes.txt and write 'we are so back!'",
  },
  {
    text: "Inspect this desktop",
    prompt: "Capture a screenshot of the current desktop and tell me what you see",
  },
];

export const PromptSuggestions = ({
  onSelectPrompt,
  disabled,
}: {
  onSelectPrompt: (prompt: string) => void;
  disabled: boolean;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          type="button"
          variant="pill"
          size="pill"
          onClick={() => onSelectPrompt(suggestion.prompt)}
          disabled={disabled}
          aria-label={`Use preset: ${suggestion.text}`}
        >
          <span className="text-[11px] text-zinc-600">{suggestion.text}</span>
        </Button>
      ))}
    </div>
  );
};
