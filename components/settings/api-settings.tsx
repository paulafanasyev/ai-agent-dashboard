/**
 * File: components/settings/api-settings.tsx
 * Purpose: List tab-scoped API profiles and edit one only inside a focused dialog.
 * Problem solved: Keeps saved configurations visible by default while moving credential entry into an explicit add/edit flow.
 */
"use client";

import {
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEEPSEEK_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_DEEPSEEK_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  KIMI_BASE_URL,
  isSafeCustomBaseUrl,
  modelProviderLabel,
  type ApiConfigProfile,
  type ClientModelConfig,
  type DeepSeekThinkingMode,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import { cn } from "@/lib/utils";

type EditableProvider = "anthropic-byok" | "kimi" | "deepseek" | "custom";

interface ApiSettingsProps {
  profiles: ApiConfigProfile[];
  modelDisabled: boolean;
  projectClaudeAvailable: boolean;
  onCreate: (profile: ApiConfigProfile) => void;
  onUpdate: (profile: ApiConfigProfile) => void;
  onDelete: (profileId: string) => void;
}

/** Shows saved configurations first and opens a secondary dialog only for add/edit actions. */
export function ApiSettings({
  profiles,
  modelDisabled,
  projectClaudeAvailable,
  onCreate,
  onUpdate,
  onDelete,
}: ApiSettingsProps) {
  const [editorProfileId, setEditorProfileId] = useState<
    string | null | undefined
  >(undefined);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    string | null
  >(null);
  const editingProfile =
    editorProfileId === null || editorProfileId === undefined
      ? null
      : profiles.find((profile) => profile.id === editorProfileId) ?? null;
  const editorOpen = editorProfileId !== undefined;

  const deleteProfile = (profile: ApiConfigProfile) => {
    if (deleteConfirmationId !== profile.id) {
      setDeleteConfirmationId(profile.id);
      return;
    }
    onDelete(profile.id);
    setDeleteConfirmationId(null);
    toast.success(`${profile.config.modelId} deleted`);
  };

  const saveProfile = (profile: ApiConfigProfile) => {
    if (editingProfile) {
      onUpdate(profile);
      toast.success(`${profile.config.modelId} updated`);
    } else {
      onCreate(profile);
      toast.success(`${profile.config.modelId} added`);
    }
    setEditorProfileId(undefined);
  };

  return (
    <section
      aria-labelledby="api-configuration-title"
      className="px-5 py-6 sm:px-7"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 id="api-configuration-title" className="text-sm font-semibold">
            API Configuration
          </h3>
          <p className="mt-1 text-[10px] text-zinc-500">
            Configurations are used in list order unless a Conversation selects another model.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorProfileId(null)}
          disabled={modelDisabled}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Add config
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {projectClaudeAvailable ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                <KeyRound className="size-4" />
              </span>
            </div>
            <p className="mt-4 truncate text-xs font-semibold text-zinc-900">
              Project Claude
            </p>
            <p className="mt-1 text-[9px] text-zinc-500">
              Anthropic · Built-in server key
            </p>
          </div>
        ) : null}

        {profiles.map((profile) => {
          const confirmingDelete = deleteConfirmationId === profile.id;
          return (
            <div
              key={profile.id}
              className="group rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 transition-colors hover:bg-zinc-100"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                  <KeyRound className="size-4" />
                </span>
              </div>

              <p className="mt-4 truncate font-mono text-xs font-semibold text-zinc-900">
                {profile.config.modelId}
              </p>
              <p className="mt-1 text-[9px] text-zinc-500">
                {modelProviderLabel(profile.config)}
                {profile.config.provider === "deepseek"
                  ? ` · Thinking ${profile.config.thinkingMode === "enabled" ? "on" : "off"}`
                  : ""}
              </p>

              <div className="mt-3 flex items-center justify-end gap-1 border-t border-zinc-200/70 pt-3">
                <button
                  type="button"
                  onClick={() => setEditorProfileId(profile.id)}
                  disabled={modelDisabled}
                  aria-label={`Edit ${profile.config.modelId}`}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[9px] text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteProfile(profile)}
                  disabled={modelDisabled}
                  aria-label={`Delete ${profile.config.modelId}`}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-md px-2 text-[9px] transition-colors",
                    confirmingDelete
                      ? "bg-red-500/15 text-red-400"
                      : "text-zinc-400 hover:bg-red-500/10 hover:text-red-400",
                  )}
                >
                  <Trash2 className="size-3" />
                  {confirmingDelete ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {profiles.length === 0 && !projectClaudeAvailable ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/30 px-5 py-10 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
            <KeyRound className="size-4" />
          </span>
          <p className="mt-3 text-xs font-semibold text-zinc-800">
            No API configurations yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[10px] leading-4 text-zinc-500">
            Add a provider key and model to start running Conversations.
          </p>
          <button
            type="button"
            onClick={() => setEditorProfileId(null)}
            disabled={modelDisabled}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            <Plus className="size-3.5" /> Add config
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex gap-2 rounded-xl bg-emerald-950/30 p-3 text-[10px] leading-4 text-emerald-400">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <p>Keys stay in this browser tab and are cleared when the tab closes.</p>
      </div>

      {modelDisabled ? (
        <p className="mt-4 text-xs text-amber-300">
          API settings are locked while the agent is running.
        </p>
      ) : null}

      {editorOpen
        ? createPortal(
            <ApiConfigEditorDialog
              key={editingProfile?.id ?? "new-api-config"}
              profile={editingProfile}
              onCancel={() => setEditorProfileId(undefined)}
              onSave={saveProfile}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

function ApiConfigEditorDialog({
  profile,
  onCancel,
  onSave,
}: {
  profile: ApiConfigProfile | null;
  onCancel: () => void;
  onSave: (profile: ApiConfigProfile) => void;
}) {
  const config = profile?.config;
  const [provider, setProvider] = useState<EditableProvider>(
    config?.provider ?? "anthropic-byok",
  );
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [modelId, setModelId] = useState(
    config?.modelId ?? DEFAULT_ANTHROPIC_MODEL_ID,
  );
  const [baseUrl, setBaseUrl] = useState(
    config?.provider === "custom" ? config.baseUrl : "",
  );
  const [reasoningEffort, setReasoningEffort] =
    useState<KimiReasoningEffort>(
      config?.provider === "kimi" ? config.reasoningEffort : "high",
    );
  const [deepSeekThinking, setDeepSeekThinking] =
    useState<DeepSeekThinkingMode>(
      config?.provider === "deepseek" ? config.thinkingMode : "disabled",
    );
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const changeProvider = (nextProvider: EditableProvider) => {
    setProvider(nextProvider);
    setError(null);
    if (nextProvider === "anthropic-byok") setModelId(DEFAULT_ANTHROPIC_MODEL_ID);
    if (nextProvider === "kimi") setModelId(DEFAULT_KIMI_MODEL_ID);
    if (nextProvider === "deepseek") setModelId(DEFAULT_DEEPSEEK_MODEL_ID);
    if (nextProvider === "custom") setModelId("");
  };

  const buildConfig = (): ClientModelConfig | null => {
    const trimmedKey = apiKey.trim();
    const trimmedModel = modelId.trim();
    if (trimmedKey.length < 8) {
      setError("Enter an API key with at least 8 characters.");
      return null;
    }
    if (!trimmedModel) {
      setError("Enter a model ID.");
      return null;
    }
    if (provider === "custom") {
      const trimmedBaseUrl = baseUrl.trim().replace(/\/$/, "");
      if (!isSafeCustomBaseUrl(trimmedBaseUrl)) {
        setError("Enter a public HTTPS Base URL.");
        return null;
      }
      return {
        provider,
        apiKey: trimmedKey,
        baseUrl: trimmedBaseUrl,
        modelId: trimmedModel,
      };
    }
    if (provider === "kimi") {
      return {
        provider,
        apiKey: trimmedKey,
        modelId: trimmedModel,
        reasoningEffort,
      };
    }
    if (provider === "deepseek") {
      return {
        provider,
        apiKey: trimmedKey,
        modelId: trimmedModel,
        thinkingMode: deepSeekThinking,
      };
    }
    return { provider, apiKey: trimmedKey, modelId: trimmedModel };
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextConfig = buildConfig();
    if (!nextConfig || nextConfig.provider === "anthropic") return;
    onSave({
      id: profile?.id ?? crypto.randomUUID(),
      name: nextConfig.modelId,
      config: nextConfig,
    });
  };

  const fixedBaseUrl =
    provider === "kimi"
      ? KIMI_BASE_URL
      : provider === "deepseek"
        ? DEEPSEEK_BASE_URL
        : null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-config-editor-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h4 id="api-config-editor-title" className="text-sm font-semibold">
              {profile ? "Edit API configuration" : "Add API configuration"}
            </h4>
            <p className="mt-1 text-[10px] text-zinc-500">
              The saved configuration will use its Model ID as the name.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close API configuration"
            className="-mr-2 -mt-2 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={submit} className="min-h-0 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <select
                id="byok-provider"
                aria-label="Provider"
                value={provider}
                onChange={(event) =>
                  changeProvider(event.target.value as EditableProvider)
                }
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-violet-400"
              >
                <option value="anthropic-byok">Anthropic</option>
                <option value="kimi">Kimi</option>
                <option value="deepseek">DeepSeek</option>
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
                  autoFocus
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

            {fixedBaseUrl ? (
              <div className="space-y-2">
                <Label>
                  {provider === "kimi" ? "Kimi" : "DeepSeek"} Base URL
                </Label>
                <div className="flex h-9 items-center truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-600">
                  {fixedBaseUrl}
                </div>
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-3",
                provider === "custom" || provider === "kimi"
                  ? "sm:grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {provider === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-base-url">Base URL</Label>
                  <Input
                    id="custom-base-url"
                    type="url"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://example.com/v1"
                    spellCheck={false}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="api-model-id">Model ID</Label>
                <Input
                  id="api-model-id"
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  placeholder={
                    provider === "deepseek"
                      ? DEFAULT_DEEPSEEK_MODEL_ID
                      : "model-name"
                  }
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              {provider === "kimi" ? (
                <div className="space-y-2">
                  <Label htmlFor="kimi-reasoning-effort">
                    Reasoning effort
                  </Label>
                  <select
                    id="kimi-reasoning-effort"
                    value={reasoningEffort}
                    onChange={(event) =>
                      setReasoningEffort(
                        event.target.value as KimiReasoningEffort,
                      )
                    }
                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="max">Max</option>
                  </select>
                </div>
              ) : null}
            </div>

            {provider === "deepseek" ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-zinc-800">
                  Thinking mode
                </legend>
                <div
                  role="radiogroup"
                  aria-label="DeepSeek thinking mode"
                  className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1"
                >
                  {(
                    [
                      ["disabled", "Off", "Reliable Desktop tools"],
                      ["enabled", "On", "Deeper reasoning"],
                    ] as const
                  ).map(([value, title, description]) => {
                    const selected = deepSeekThinking === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setDeepSeekThinking(value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-violet-400/50 bg-surface text-zinc-900 shadow-sm"
                            : "border-transparent text-zinc-500 hover:text-zinc-800",
                        )}
                      >
                        <span className="block text-[11px] font-semibold">
                          {title}
                          {value === "disabled" ? (
                            <span className="ml-1.5 text-[8px] font-medium text-emerald-500">
                              Recommended
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[9px]">
                          {description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] leading-4 text-zinc-500">
                  Thinking on uses automatic tool selection; off can force the
                  first visible Desktop action and is more reliable for agent tasks.
                </p>
              </fieldset>
            ) : null}

            {error ? <p className="text-xs text-amber-300">{error}</p> : null}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
            <div className="hidden items-center gap-2 text-[9px] text-emerald-400 sm:flex">
              <ShieldCheck className="size-3.5" /> Tab-scoped credential
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-lg px-3 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85"
              >
                {profile ? "Save changes" : "Add configuration"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
