/**
 * File: components/theme-switcher.tsx
 * Purpose: Select a researched dark interface theme and preview its visual hierarchy.
 * Problem solved: Keeps every canvas dark while making brand accents, text contrast, and active states easy to compare before use.
 */
"use client";

import { Bot, Check, ChevronDown, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  DASHBOARD_THEMES,
  type DashboardTheme,
} from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemePalette {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
}

interface ThemeDefinition {
  id: DashboardTheme;
  label: string;
  description: string;
  palette: ThemePalette;
}

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: "vercel",
    label: "Vercel",
    description: "Neutral black and white",
    palette: {
      background: "#000000",
      surface: "#0a0a0a",
      elevated: "#171717",
      border: "#262626",
      text: "#fafafa",
      muted: "#a1a1aa",
      accent: "#fafafa",
      accentSoft: "#27272a",
      accentText: "#000000",
    },
  },
  {
    id: "vue",
    label: "Vue",
    description: "Vue green on neutral charcoal",
    palette: {
      background: "#1a1a1a",
      surface: "#242424",
      elevated: "#2f2f2f",
      border: "#545454",
      text: "#ffffffde",
      muted: "#ebebeb99",
      accent: "#42d392",
      accentSoft: "#194936",
      accentText: "#0b1712",
    },
  },
  {
    id: "codex",
    label: "Codex",
    description: "OpenAI graphite and code green",
    palette: {
      background: "#0c0e0d",
      surface: "#121514",
      elevated: "#1d2320",
      border: "#2b332f",
      text: "#f0f3f1",
      muted: "#929d97",
      accent: "#19c37d",
      accentSoft: "#0d3b2d",
      accentText: "#06150f",
    },
  },
  {
    id: "xcode",
    label: "Xcode",
    description: "Apple graphite and system blue",
    palette: {
      background: "#121214",
      surface: "#1c1c1e",
      elevated: "#2c2c2e",
      border: "#3a3a3c",
      text: "#f2f2f7",
      muted: "#8e8e93",
      accent: "#0a84ff",
      accentSoft: "#092c55",
      accentText: "#ffffff",
    },
  },
  {
    id: "github",
    label: "GitHub",
    description: "Primer dark canvas and link blue",
    palette: {
      background: "#0d1117",
      surface: "#151b23",
      elevated: "#212830",
      border: "#3d444d",
      text: "#f0f6fc",
      muted: "#9198a1",
      accent: "#1f6feb",
      accentSoft: "#0c2d6b",
      accentText: "#ffffff",
    },
  },
];

function isDashboardTheme(theme: string | undefined): theme is DashboardTheme {
  return DASHBOARD_THEMES.includes(theme as DashboardTheme);
}

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const activeTheme = isDashboardTheme(theme) ? theme : "vercel";
  const activeDefinition =
    THEME_DEFINITIONS.find((definition) => definition.id === activeTheme) ??
    THEME_DEFINITIONS[0];
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const frame = window.requestAnimationFrame(() => selectedRef.current?.focus());
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const moveOptionFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    );
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <div className="space-y-4">
      <div ref={rootRef} className="relative">
        <label className="mb-2 block text-[10px] font-medium text-zinc-500">
          Interface theme
        </label>
        <button
          type="button"
          aria-label="Choose interface theme"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-left outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <ThemeSwatch palette={activeDefinition.palette} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-zinc-900">
              {activeDefinition.label}
            </span>
            <span className="block truncate text-[9px] text-zinc-500">
              {activeDefinition.description}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-zinc-400 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen ? (
          <div
            role="listbox"
            aria-label="Interface themes"
            onKeyDown={moveOptionFocus}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-surface p-1.5 shadow-2xl"
          >
            {THEME_DEFINITIONS.map((definition) => {
              const selected = definition.id === activeTheme;
              return (
                <button
                  ref={selected ? selectedRef : undefined}
                  key={definition.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setTheme(definition.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-100",
                    selected && "bg-zinc-100",
                  )}
                >
                  <ThemeSwatch palette={definition.palette} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-zinc-800">
                      {definition.label}
                    </span>
                    <span className="block truncate text-[9px] text-zinc-500">
                      {definition.description}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-3.5 shrink-0 text-violet-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <ThemePreview definition={activeDefinition} />
    </div>
  );
}

function ThemeSwatch({ palette }: { palette: ThemePalette }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center gap-1 rounded-lg border"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
      }}
      aria-hidden="true"
    >
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: palette.accent }}
      />
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: palette.text }}
      />
    </span>
  );
}

function ThemePreview({ definition }: { definition: ThemeDefinition }) {
  const palette = definition.palette;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium text-zinc-500">Preview</span>
        <span className="text-[9px] text-zinc-400">{definition.label} · Dark</span>
      </div>
      <div
        className="overflow-hidden rounded-2xl border shadow-xl"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.border,
          color: palette.text,
        }}
      >
        <div
          className="flex h-10 items-center justify-between border-b px-3"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <span className="flex items-center gap-2 text-[10px] font-semibold">
            <span
              className="flex size-5 items-center justify-center rounded-md"
              style={{ backgroundColor: palette.accent, color: palette.accentText }}
            >
              <Bot className="size-3" />
            </span>
            Agent Desk
          </span>
          <span className="flex items-center gap-1.5 text-[8px]" style={{ color: palette.muted }}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: palette.accent }} />
            Ready
          </span>
        </div>

        <div className="grid h-48 grid-cols-[42px_1fr]">
          <div
            className="flex flex-col items-center gap-2 border-r py-2"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          >
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: palette.accent, color: palette.accentText }}
            >
              <Monitor className="size-3.5" />
            </span>
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: palette.elevated, color: palette.muted }}
            >
              <Monitor className="size-3.5" />
            </span>
          </div>

          <div className="flex min-w-0 flex-col p-3">
            <p className="text-[10px] font-semibold">Agent workspace</p>
            <p className="mt-1 text-[8px]" style={{ color: palette.muted }}>
              Live actions remain visible while the task runs.
            </p>
            <div
              className="mt-3 rounded-xl border p-2.5"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: palette.accent }}
                />
                <span className="text-[9px] font-semibold">Inspecting the page</span>
              </div>
              <div className="mt-2 h-1.5 w-4/5 rounded-full" style={{ backgroundColor: palette.elevated }} />
              <div className="mt-1.5 h-1.5 w-3/5 rounded-full" style={{ backgroundColor: palette.elevated }} />
            </div>
            <div
              className="mt-auto flex h-8 items-center justify-between rounded-lg border px-2.5"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <span className="text-[8px]" style={{ color: palette.muted }}>Queue a follow-up…</span>
              <span
                className="flex size-5 items-center justify-center rounded-md text-[10px]"
                style={{ backgroundColor: palette.accent, color: palette.accentText }}
              >
                ↑
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
