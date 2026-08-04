/**
 * File: components/model-settings.tsx
 * Purpose: Provide one auto-saving settings panel for API access and interface themes.
 * Problem solved: Consolidates configuration in a bottom-left entry while keeping BYOK credentials tab-scoped and eliminating manual save steps.
 */
"use client";

import {
  CircleHelp,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  MonitorCog,
  Palette,
  Play,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeSettings } from "@/components/theme-switcher";
import { DataSettings } from "@/components/settings/data-settings";
import { VncDiagnosticsSettings } from "@/components/settings/vnc-diagnostics-settings";
import {
  SaveStatus,
  SettingsChoice,
  SettingsNavItem,
  type SaveState,
} from "@/components/settings/settings-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  KIMI_BASE_URL,
  isSafeCustomBaseUrl,
  modelConfigLabel,
  type ClientModelConfig,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import type {
  VncClientDiagnostics,
  VncServerDiagnostics,
} from "@/lib/sandbox/diagnostics";
import { OPEN_API_SETTINGS_EVENT } from "@/lib/dashboard/settings-events";
import { cn } from "@/lib/utils";

interface DashboardSettingsProps {
  config: ClientModelConfig;
  modelDisabled: boolean;
  trigger: "rail" | "icon";
  onConfigChange: (config: ClientModelConfig) => void;
  onReplayTutorial: () => void;
  onClearAllData: () => Promise<void>;
  vncClientDiagnostics: VncClientDiagnostics;
  onRunVncDiagnostics: () => Promise<VncServerDiagnostics>;
  onReconnectVnc: () => void;
  projectClaudeAvailable: boolean;
}

type AccessMode = "project" | "byok";
type ByokProvider = "anthropic-byok" | "kimi" | "custom";
type SettingsSection = "api" | "appearance" | "tutorial" | "vnc" | "data";

function sameConfig(left: ClientModelConfig, right: ClientModelConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function byokProviderForConfig(config: ClientModelConfig): ByokProvider {
  if (config.provider === "anthropic-byok") return "anthropic-byok";
  if (config.provider === "kimi") return "kimi";
  if (config.provider === "custom") return "custom";
  return "anthropic-byok";
}

export function DashboardSettings({
  config,
  modelDisabled,
  trigger,
  onConfigChange,
  onReplayTutorial,
  onClearAllData,
  vncClientDiagnostics,
  onRunVncDiagnostics,
  onReconnectVnc,
  projectClaudeAvailable,
}: DashboardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>(
    config.provider === "anthropic" && projectClaudeAvailable
      ? "project"
      : "byok",
  );
  const [byokProvider, setByokProvider] = useState<ByokProvider>(
    byokProviderForConfig(config),
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
  const [anthropicModelId, setAnthropicModelId] = useState(
    config.provider === "anthropic-byok"
      ? config.modelId
      : DEFAULT_ANTHROPIC_MODEL_ID,
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
      if (!projectClaudeAvailable) {
        return { config: null, error: "Project Claude is unavailable here." };
      }
      return { config: { provider: "anthropic" }, error: null };
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 8) {
      return { config: null, error: "Enter an API key with at least 8 characters." };
    }

    if (byokProvider === "anthropic-byok") {
      const modelId = anthropicModelId.trim();
      if (!modelId) {
        return { config: null, error: "Enter the Anthropic model ID." };
      }
      return {
        config: {
          provider: "anthropic-byok",
          apiKey: trimmedKey,
          modelId,
        },
        error: null,
      };
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
    anthropicModelId,
    apiKey,
    byokProvider,
    customBaseUrl,
    customModelId,
    kimiModelId,
    projectClaudeAvailable,
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

  const open = useCallback(() => {
    setAccessMode(
      config.provider === "anthropic" && projectClaudeAvailable
        ? "project"
        : "byok",
    );
    setByokProvider(byokProviderForConfig(config));
    setApiKey(config.provider !== "anthropic" ? config.apiKey : "");
    setReasoningEffort(
      config.provider === "kimi" ? config.reasoningEffort : "high",
    );
    setKimiModelId(
      config.provider === "kimi" ? config.modelId : DEFAULT_KIMI_MODEL_ID,
    );
    setAnthropicModelId(
      config.provider === "anthropic-byok"
        ? config.modelId
        : DEFAULT_ANTHROPIC_MODEL_ID,
    );
    setCustomBaseUrl(config.provider === "custom" ? config.baseUrl : "");
    setCustomModelId(config.provider === "custom" ? config.modelId : "");
    setShowKey(false);
    setSaveState("saved");
    setActiveSection("api");
    setIsOpen(true);
  }, [config, projectClaudeAvailable]);

  useEffect(() => {
    const openApiConfiguration = () => open();
    window.addEventListener(OPEN_API_SETTINGS_EVENT, openApiConfiguration);
    return () =>
      window.removeEventListener(OPEN_API_SETTINGS_EVENT, openApiConfiguration);
  }, [open]);

  const isByok = accessMode === "byok";
  const apiControlsDisabled = modelDisabled;

  return (
    <>
      <button
        data-tutorial="settings"
        type="button"
        onClick={open}
        aria-label="Open settings"
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
                  className="grid grid-cols-5 gap-1 md:flex md:flex-col"
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
                  <SettingsNavItem
                    icon={<MonitorCog className="size-4" />}
                    label="VNC Diagnostics"
                    compactLabel="VNC"
                    description="Connection health"
                    active={activeSection === "vnc"}
                    onClick={() => setActiveSection("vnc")}
                  />
                  <SettingsNavItem
                    icon={<Database className="size-4" />}
                    label="Data and storage"
                    compactLabel="Data"
                    description="Clear browser data"
                    active={activeSection === "data"}
                    onClick={() => setActiveSection("data")}
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
                      Current:{" "}
                      {config.provider === "anthropic" &&
                      !projectClaudeAvailable
                        ? "BYOK required"
                        : modelConfigLabel(config)}
                    </p>
                  </div>
                  <SaveStatus
                    disabled={modelDisabled}
                    state={saveState}
                  />
                </div>

                <fieldset disabled={apiControlsDisabled} className="space-y-4">
                  {projectClaudeAvailable ? (
                    <SettingsChoice
                      label="Access method"
                      options={[
                        { value: "project", label: "Project Claude" },
                        { value: "byok", label: "BYOK" },
                      ]}
                      value={accessMode}
                      onChange={(value) => setAccessMode(value as AccessMode)}
                    />
                  ) : null}

                  {isByok ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="byok-provider">Provider</Label>
                        <select
                          id="byok-provider"
                          value={byokProvider}
                          onChange={(event) =>
                            setByokProvider(event.target.value as ByokProvider)
                          }
                          className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-violet-400"
                        >
                          <option value="anthropic-byok">Anthropic</option>
                          <option value="kimi">Kimi</option>
                          <option value="custom">OpenAI-compatible</option>
                        </select>
                      </div>

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

                      {byokProvider === "anthropic-byok" ? (
                        <div className="space-y-2">
                          <Label htmlFor="anthropic-model-id">Model ID</Label>
                          <Input
                            id="anthropic-model-id"
                            value={anthropicModelId}
                            onChange={(event) =>
                              setAnthropicModelId(event.target.value)
                            }
                            placeholder={DEFAULT_ANTHROPIC_MODEL_ID}
                            spellCheck={false}
                            className="font-mono"
                          />
                          <p className="text-[10px] leading-4 text-zinc-500">
                            Uses the official Anthropic Messages API.
                          </p>
                        </div>
                      ) : byokProvider === "kimi" ? (
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
                ) : activeSection === "tutorial" ? (
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
                ) : activeSection === "vnc" ? (
                  <VncDiagnosticsSettings
                    client={vncClientDiagnostics}
                    reconnectDisabled={modelDisabled}
                    onRunDiagnostics={onRunVncDiagnostics}
                    onReconnect={onReconnectVnc}
                  />
                ) : (
                  <DataSettings
                    disabled={modelDisabled}
                    onClearAllData={async () => {
                      await onClearAllData();
                      setIsOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
