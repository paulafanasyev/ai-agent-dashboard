/**
 * File: components/model-settings.tsx
 * Purpose: Provide one auto-saving settings panel for API access and interface themes.
 * Problem solved: Consolidates configuration in a bottom-left entry while keeping BYOK credentials tab-scoped and eliminating manual save steps.
 */
"use client";

import {
  CheckCircle2,
  CircleHelp,
  Eye,
  EyeOff,
  KeyRound,
  Palette,
  Play,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeSettings } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_KIMI_MODEL_ID,
  KIMI_BASE_URL,
  isSafeCustomBaseUrl,
  modelConfigLabel,
  type ClientModelConfig,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import { cn } from "@/lib/utils";

interface DashboardSettingsProps {
  config: ClientModelConfig;
  modelDisabled: boolean;
  trigger: "rail" | "icon";
  onConfigChange: (config: ClientModelConfig) => void;
  onReplayTutorial: () => void;
}

type AccessMode = "project" | "byok";
type ByokProvider = "kimi" | "custom";
type SaveState = "saved" | "pending" | "incomplete";
type SettingsSection = "api" | "appearance" | "tutorial";

function sameConfig(left: ClientModelConfig, right: ClientModelConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function DashboardSettings({
  config,
  modelDisabled,
  trigger,
  onConfigChange,
  onReplayTutorial,
}: DashboardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>(
    config.provider === "anthropic" ? "project" : "byok",
  );
  const [byokProvider, setByokProvider] = useState<ByokProvider>(
    config.provider === "custom" ? "custom" : "kimi",
  );
  const [apiKey, setApiKey] = useState(
    config.provider !== "anthropic" ? config.apiKey : "",
  );
  const [reasoningEffort, setReasoningEffort] =
    useState<KimiReasoningEffort>(
      config.provider === "kimi" ? config.reasoningEffort : "high",
    );
  const [kimiModelId, setKimiModelId] = useState(
    config.provider === "kimi" ? config.modelId : DEFAULT_KIMI_MODEL_ID,
  );
  const [customBaseUrl, setCustomBaseUrl] = useState(
    config.provider === "custom" ? config.baseUrl : "",
  );
  const [customModelId, setCustomModelId] = useState(
    config.provider === "custom" ? config.modelId : "",
  );
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("api");

  const draftResult = useMemo<
    { config: ClientModelConfig; error: null } | { config: null; error: string }
  >(() => {
    if (accessMode === "project") {
      return { config: { provider: "anthropic" }, error: null };
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 8) {
      return { config: null, error: "Enter an API key with at least 8 characters." };
    }

    if (byokProvider === "custom") {
      const baseUrl = customBaseUrl.trim().replace(/\/$/, "");
      const modelId = customModelId.trim();
      if (!isSafeCustomBaseUrl(baseUrl)) {
        return {
          config: null,
          error: "Enter a public HTTPS Base URL.",
        };
      }
      if (!modelId) {
        return { config: null, error: "Enter the custom model ID." };
      }
      return {
        config: { provider: "custom", apiKey: trimmedKey, baseUrl, modelId },
        error: null,
      };
    }

    const modelId = kimiModelId.trim();
    if (!modelId) {
      return { config: null, error: "Enter the Kimi model ID." };
    }
    return {
      config: {
        provider: "kimi",
        apiKey: trimmedKey,
        modelId,
        reasoningEffort,
      },
      error: null,
    };
  }, [
    accessMode,
    apiKey,
    byokProvider,
    customBaseUrl,
    customModelId,
    kimiModelId,
    reasoningEffort,
  ]);

  useEffect(() => {
    if (!isOpen || modelDisabled) return;
    if (!draftResult.config) {
      setSaveState("incomplete");
      return;
    }
    if (sameConfig(draftResult.config, config)) {
      setSaveState("saved");
      return;
    }
    setSaveState("pending");
    const timeout = window.setTimeout(() => {
      onConfigChange(draftResult.config);
      setSaveState("saved");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [config, draftResult, isOpen, modelDisabled, onConfigChange]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const open = () => {
    setAccessMode(config.provider === "anthropic" ? "project" : "byok");
    setByokProvider(config.provider === "custom" ? "custom" : "kimi");
    setApiKey(config.provider !== "anthropic" ? config.apiKey : "");
    setReasoningEffort(
      config.provider === "kimi" ? config.reasoningEffort : "high",
    );
    setKimiModelId(
      config.provider === "kimi" ? config.modelId : DEFAULT_KIMI_MODEL_ID,
    );
    setCustomBaseUrl(config.provider === "custom" ? config.baseUrl : "");
    setCustomModelId(config.provider === "custom" ? config.modelId : "");
    setShowKey(false);
    setSaveState("saved");
    setActiveSection("api");
    setIsOpen(true);
  };

  const isByok = accessMode === "byok";
  const apiControlsDisabled = modelDisabled;

  return (
    <>
      <button
        data-tutorial="settings"
        type="button"
        onClick={open}
        aria-label="Open settings"
        title="Settings"
        className={cn(
          "flex items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-400",
          trigger === "rail"
            ? "h-9 w-full"
            : "size-8 bg-zinc-100",
        )}
      >
        <Settings className="size-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-settings-title"
            className="flex h-[calc(100dvh-24px)] max-h-[760px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 id="dashboard-settings-title" className="font-semibold">
                  Settings
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  API and appearance changes are saved automatically.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2"
                onClick={() => setIsOpen(false)}
                aria-label="Close settings"
              >
                <X />
              </Button>
            </header>

            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[210px_minmax(0,1fr)] md:grid-rows-1">
              <aside className="border-b border-zinc-200 bg-zinc-50/40 p-2.5 md:border-b-0 md:border-r md:p-3">
                <p className="mb-2 hidden px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400 md:block">
                  Preferences
                </p>
                <nav
                  aria-label="Settings sections"
                  className="grid grid-cols-3 gap-1 md:flex md:flex-col"
                >
                  <SettingsNavItem
                    icon={<KeyRound className="size-4" />}
                    label="API Configuration"
                    compactLabel="API"
                    description="Access and models"
                    active={activeSection === "api"}
                    onClick={() => setActiveSection("api")}
                  />
                  <SettingsNavItem
                    icon={<Palette className="size-4" />}
                    label="Appearance"
                    compactLabel="Theme"
                    description="Theme and preview"
                    active={activeSection === "appearance"}
                    onClick={() => setActiveSection("appearance")}
                  />
                  <SettingsNavItem
                    icon={<CircleHelp className="size-4" />}
                    label="Tutorial"
                    compactLabel="Tutorial"
                    description="Replay the product tour"
                    active={activeSection === "tutorial"}
                    onClick={() => setActiveSection("tutorial")}
                  />
                </nav>
              </aside>

              <div className="min-h-0 overflow-y-auto">
                {activeSection === "api" ? (
                  <section
                    aria-labelledby="api-configuration-title"
                    className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
                  >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3
                      id="api-configuration-title"
                      className="text-sm font-semibold"
                    >
                      API Configuration
                    </h3>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Current: {modelConfigLabel(config)}
                    </p>
                  </div>
                  <SaveStatus
                    disabled={modelDisabled}
                    state={saveState}
                  />
                </div>

                <fieldset disabled={apiControlsDisabled} className="space-y-4">
                  <SettingsChoice
                    label="Access method"
                    options={[
                      { value: "project", label: "Project Claude" },
                      { value: "byok", label: "BYOK" },
                    ]}
                    value={accessMode}
                    onChange={(value) => setAccessMode(value as AccessMode)}
                  />

                  {isByok ? (
                    <>
                      <SettingsChoice
                        label="Provider"
                        options={[
                          { value: "kimi", label: "Kimi" },
                          { value: "custom", label: "Custom" },
                        ]}
                        value={byokProvider}
                        onChange={(value) =>
                          setByokProvider(value as ByokProvider)
                        }
                      />

                      <div className="space-y-2">
                        <Label htmlFor="byok-api-key">API Key</Label>
                        <div className="relative">
                          <Input
                            id="byok-api-key"
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder="sk-..."
                            autoComplete="off"
                            spellCheck={false}
                            className="pr-10 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey((value) => !value)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900"
                            aria-label={showKey ? "Hide API key" : "Show API key"}
                          >
                            {showKey ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {byokProvider === "kimi" ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Kimi Base URL</Label>
                            <div className="flex h-9 items-center truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-600">
                              {KIMI_BASE_URL}
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                            <div className="space-y-2">
                              <Label htmlFor="kimi-model-id">Model ID</Label>
                              <Input
                                id="kimi-model-id"
                                value={kimiModelId}
                                onChange={(event) =>
                                  setKimiModelId(event.target.value)
                                }
                                placeholder={DEFAULT_KIMI_MODEL_ID}
                                spellCheck={false}
                                className="font-mono"
                              />
                            </div>
                            <SettingsChoice
                              compact
                              label="Reasoning effort"
                              options={[
                                { value: "low", label: "Low" },
                                { value: "high", label: "High" },
                                { value: "max", label: "Max" },
                              ]}
                              value={reasoningEffort}
                              onChange={(value) =>
                                setReasoningEffort(value as KimiReasoningEffort)
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="custom-base-url">Base URL</Label>
                            <Input
                              id="custom-base-url"
                              type="url"
                              value={customBaseUrl}
                              onChange={(event) =>
                                setCustomBaseUrl(event.target.value)
                              }
                              placeholder="https://example.com/v1"
                              spellCheck={false}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="custom-model-id">Model ID</Label>
                            <Input
                              id="custom-model-id"
                              value={customModelId}
                              onChange={(event) =>
                                setCustomModelId(event.target.value)
                              }
                              placeholder="model-name"
                              spellCheck={false}
                            />
                          </div>
                        </div>
                      )}

                      {draftResult.error ? (
                        <p className="text-xs text-amber-300">
                          {draftResult.error} Changes apply when this is complete.
                        </p>
                      ) : null}

                      <div className="flex gap-2 rounded-xl bg-emerald-950/60 p-3 text-xs leading-5 text-emerald-300">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                        <p>
                          Your key stays in this browser tab and is cleared when
                          the tab closes.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
                      Uses the Anthropic configuration stored in server environment
                      variables. The project key is never exposed to the browser.
                    </p>
                  )}
                </fieldset>

                {modelDisabled ? (
                  <p className="mt-3 text-xs text-amber-300">
                    API settings are locked while the agent is running.
                  </p>
                ) : null}
                  </section>
                ) : activeSection === "appearance" ? (
                  <section
                    aria-labelledby="theme-settings-title"
                    className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
                  >
                    <div className="mb-5">
                      <h3
                        id="theme-settings-title"
                        className="text-sm font-semibold"
                      >
                        Appearance
                      </h3>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Choose a dark palette and preview it before closing
                        Settings.
                      </p>
                    </div>
                    <ThemeSettings />
                  </section>
                ) : (
                  <section
                    aria-labelledby="tutorial-settings-title"
                    className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
                  >
                    <div className="mb-5">
                      <h3
                        id="tutorial-settings-title"
                        className="text-sm font-semibold"
                      >
                        Product tutorial
                      </h3>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Revisit the guided tour whenever you need a quick
                        refresher.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60">
                      <div className="border-b border-zinc-200 bg-gradient-to-br from-violet-500/15 via-transparent to-sky-500/10 p-5">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                          <CircleHelp className="size-5" />
                        </span>
                        <h4 className="mt-4 text-sm font-semibold text-zinc-900">
                          Tour the Agent Desk workspace
                        </h4>
                        <p className="mt-1 max-w-lg text-xs leading-5 text-zinc-500">
                          See how desktops, conversations, the live computer,
                          event inspector, and settings fit together. You can
                          skip or exit the tour at any time.
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                        <p className="text-[10px] leading-4 text-zinc-500">
                          The tour will begin over your current workspace.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            window.requestAnimationFrame(onReplayTutorial);
                          }}
                          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                          <Play className="size-3.5 fill-current" />
                          Start tutorial
                        </button>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SettingsNavItem({
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

function SettingsChoice({
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

function SaveStatus({
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
