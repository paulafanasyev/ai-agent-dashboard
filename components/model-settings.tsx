/**
 * File: components/model-settings.tsx
 * Purpose: Compose the auto-saving settings dialog and its navigation sections.
 * Problem solved: Keeps settings navigation and modal behavior separate from provider-specific forms and state.
 */
"use client";

import {
  CircleHelp,
  Database,
  KeyRound,
  MonitorCog,
  Palette,
  Play,
  Settings,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiSettings } from "@/components/settings/api-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { SettingsNavItem } from "@/components/settings/settings-primitives";
import { VncDiagnosticsSettings } from "@/components/settings/vnc-diagnostics-settings";
import { ThemeSettings } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import type { ClientModelConfig } from "@/lib/ai/model-config";
import { OPEN_API_SETTINGS_EVENT } from "@/lib/dashboard/settings-events";
import { useModelSettingsDraft } from "@/lib/dashboard/use-model-settings-draft";
import type {
  VncClientDiagnostics,
  VncServerDiagnostics,
} from "@/lib/sandbox/diagnostics";
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

type SettingsSection = "api" | "appearance" | "tutorial" | "vnc" | "data";

/** Composes Settings navigation while each section owns its own view and domain-specific state. */
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
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("api");
  const draft = useModelSettingsDraft({
    config,
    isOpen,
    modelDisabled,
    projectClaudeAvailable,
    onConfigChange,
  });
  const resetDraft = draft.resetDraft;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const open = useCallback(() => {
    resetDraft();
    setActiveSection("api");
    setIsOpen(true);
  }, [resetDraft]);

  useEffect(() => {
    const openApiConfiguration = () => open();
    window.addEventListener(OPEN_API_SETTINGS_EVENT, openApiConfiguration);
    return () =>
      window.removeEventListener(OPEN_API_SETTINGS_EVENT, openApiConfiguration);
  }, [open]);

  return (
    <>
      <button
        data-tutorial="settings"
        type="button"
        onClick={open}
        aria-label="Open settings"
        className={cn(
          "flex items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-400",
          trigger === "rail" ? "h-9 w-full" : "size-8 bg-zinc-100",
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
                  <ApiSettings
                    config={config}
                    draft={draft}
                    modelDisabled={modelDisabled}
                    projectClaudeAvailable={projectClaudeAvailable}
                  />
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
