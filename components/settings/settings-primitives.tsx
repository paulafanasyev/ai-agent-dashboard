/**
 * File: components/settings/settings-primitives.tsx
 * Purpose: Share compact navigation, choice, and save-status controls.
 * Problem solved: Keeps repeated Settings interactions visually and behaviorally consistent.
 */
import { CheckCircle2, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SaveState = "saved" | "pending" | "incomplete";

export function SettingsNavItem({
  icon,
  label,
  compactLabel,
  description,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  compactLabel: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-zinc-200 text-zinc-900 shadow-sm"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium">
          <span className="md:hidden">{compactLabel}</span>
          <span className="hidden md:inline">{label}</span>
        </span>
        <span className="hidden truncate text-[9px] text-zinc-500 md:block">
          {description}
        </span>
      </span>
    </button>
  );
}

export function SettingsChoice({
  label,
  options,
  value,
  compact = false,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "grid gap-1 rounded-lg bg-zinc-50 p-1",
          compact ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "h-8 rounded-md px-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800",
                selected && "bg-zinc-200 text-zinc-900 shadow-sm",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SaveStatus({
  state,
  disabled,
}: {
  state: SaveState;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded-full bg-amber-950/60 px-2 py-1 text-[9px] font-medium text-amber-300">
        Locked
      </span>
    );
  }
  if (state === "incomplete") {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-1 text-[9px] font-medium text-zinc-500">
        Waiting for valid input
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-950/60 px-2 py-1 text-[9px] font-medium text-emerald-300">
      {state === "pending" ? (
        <KeyRound className="size-2.5 animate-pulse" />
      ) : (
        <CheckCircle2 className="size-2.5" />
      )}
      {state === "pending" ? "Saving…" : "Saved automatically"}
    </span>
  );
}
