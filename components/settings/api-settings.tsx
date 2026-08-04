/**
 * File: components/settings/api-settings.tsx
 * Purpose: Render provider credentials and model options for Dashboard Settings.
 * Problem solved: Presents every supported access mode through one consistent, reusable settings section.
 */
"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  SaveStatus,
  SettingsChoice,
} from "@/components/settings/settings-primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  KIMI_BASE_URL,
  modelConfigLabel,
  type ClientModelConfig,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import type {
  AccessMode,
  ByokProvider,
  ModelSettingsDraft,
} from "@/lib/dashboard/use-model-settings-draft";

interface ApiSettingsProps {
  config: ClientModelConfig;
  draft: ModelSettingsDraft;
  modelDisabled: boolean;
  projectClaudeAvailable: boolean;
}

/** Renders the validated model draft without directly persisting credentials or provider state. */
export function ApiSettings({
  config,
  draft,
  modelDisabled,
  projectClaudeAvailable,
}: ApiSettingsProps) {
  const isByok = draft.accessMode === "byok";

  return (
    <section
      aria-labelledby="api-configuration-title"
      className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 id="api-configuration-title" className="text-sm font-semibold">
            API Configuration
          </h3>
          <p className="mt-1 text-[10px] text-zinc-500">
            Current:{" "}
            {config.provider === "anthropic" && !projectClaudeAvailable
              ? "BYOK required"
              : modelConfigLabel(config)}
          </p>
        </div>
        <SaveStatus disabled={modelDisabled} state={draft.saveState} />
      </div>

      <fieldset disabled={modelDisabled} className="space-y-4">
        {projectClaudeAvailable ? (
          <SettingsChoice
            label="Access method"
            options={[
              { value: "project", label: "Project Claude" },
              { value: "byok", label: "BYOK" },
            ]}
            value={draft.accessMode}
            onChange={(value) => draft.setAccessMode(value as AccessMode)}
          />
        ) : null}

        {isByok ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <select
                id="byok-provider"
                value={draft.byokProvider}
                onChange={(event) =>
                  draft.setByokProvider(event.target.value as ByokProvider)
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
                  type={draft.showKey ? "text" : "password"}
                  value={draft.apiKey}
                  onChange={(event) => draft.setApiKey(event.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => draft.setShowKey((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900"
                  aria-label={draft.showKey ? "Hide API key" : "Show API key"}
                >
                  {draft.showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {draft.byokProvider === "anthropic-byok" ? (
              <div className="space-y-2">
                <Label htmlFor="anthropic-model-id">Model ID</Label>
                <Input
                  id="anthropic-model-id"
                  value={draft.anthropicModelId}
                  onChange={(event) =>
                    draft.setAnthropicModelId(event.target.value)
                  }
                  placeholder={DEFAULT_ANTHROPIC_MODEL_ID}
                  spellCheck={false}
                  className="font-mono"
                />
                <p className="text-[10px] leading-4 text-zinc-500">
                  Uses the official Anthropic Messages API.
                </p>
              </div>
            ) : draft.byokProvider === "kimi" ? (
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
                      value={draft.kimiModelId}
                      onChange={(event) =>
                        draft.setKimiModelId(event.target.value)
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
                    value={draft.reasoningEffort}
                    onChange={(value) =>
                      draft.setReasoningEffort(value as KimiReasoningEffort)
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
                    value={draft.customBaseUrl}
                    onChange={(event) =>
                      draft.setCustomBaseUrl(event.target.value)
                    }
                    placeholder="https://example.com/v1"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-model-id">Model ID</Label>
                  <Input
                    id="custom-model-id"
                    value={draft.customModelId}
                    onChange={(event) =>
                      draft.setCustomModelId(event.target.value)
                    }
                    placeholder="model-name"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            {draft.draftResult.error ? (
              <p className="text-xs text-amber-300">
                {draft.draftResult.error} Changes apply when this is complete.
              </p>
            ) : null}

            <div className="flex gap-2 rounded-xl bg-emerald-950/60 p-3 text-xs leading-5 text-emerald-300">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Your key stays in this browser tab and is cleared when the tab
                closes.
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
  );
}
