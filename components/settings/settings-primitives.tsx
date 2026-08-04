/**
 * File: components/settings/settings-primitives.tsx
 * Purpose: Share compact Settings navigation controls.
 * Problem solved: Keeps Settings section navigation visually and behaviorally consistent.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
