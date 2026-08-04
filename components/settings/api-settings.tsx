/**
 * File: components/settings/api-settings.tsx
 * Purpose: Manage multiple tab-scoped API profiles through one CRUD editor.
 * Problem solved: Lets users name, create, edit, delete, and default provider credentials without exposing keys to durable storage.
 */
"use client";

import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEEPSEEK_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_DEEPSEEK_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  KIMI_BASE_URL,
  PROJECT_CLAUDE_CONFIG_ID,
  isSafeCustomBaseUrl,
  modelConfigLabel,
  type ApiConfigProfile,
  type ClientModelConfig,
  type KimiReasoningEffort,
} from "@/lib/ai/model-config";
import { cn } from "@/lib/utils";

type EditableProvider = "anthropic-byok" | "kimi" | "deepseek" | "custom";

interface ApiSettingsProps {
  profiles: ApiConfigProfile[];
  defaultConfigId: string | null;
  modelDisabled: boolean;
  projectClaudeAvailable: boolean;
  onCreate: (profile: ApiConfigProfile) => void;
  onUpdate: (profile: ApiConfigProfile) => void;
  onDelete: (profileId: string) => void;
  onSetDefault: (profileId: string) => void;
}

/** Renders a profile list and an explicit, validated editor for the selected profile. */
export function ApiSettings({
  profiles,
  defaultConfigId,
  modelDisabled,
  projectClaudeAvailable,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: ApiSettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(
    profiles[0]?.id ?? null,
  );
  const [name, setName] = useState("");
  const [provider, setProvider] =
    useState<EditableProvider>("anthropic-byok");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_ANTHROPIC_MODEL_ID);
  const [baseUrl, setBaseUrl] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<KimiReasoningEffort>("high");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    string | null
  >(null);

  const editingProfile = useMemo(
    () => profiles.find((profile) => profile.id === editingId) ?? null,
    [editingId, profiles],
  );

  const resetEditor = useCallback((profile?: ApiConfigProfile) => {
    const config = profile?.config;
    setName(profile?.name ?? "");
    setProvider(config?.provider ?? "anthropic-byok");
    setApiKey(config?.apiKey ?? "");
    setModelId(
      config?.modelId ?? DEFAULT_ANTHROPIC_MODEL_ID,
    );
    setBaseUrl(config?.provider === "custom" ? config.baseUrl : "");
    setReasoningEffort(
      config?.provider === "kimi" ? config.reasoningEffort : "high",
    );
    setShowKey(false);
    setError(null);
    setDeleteConfirmationId(null);
  }, []);

  useEffect(() => {
    resetEditor(editingProfile ?? undefined);
  }, [editingProfile, resetEditor]);

  useEffect(() => {
    if (editingId && !profiles.some((profile) => profile.id === editingId)) {
      setEditingId(profiles[0]?.id ?? null);
    }
  }, [editingId, profiles]);

  const startNewProfile = () => {
    setEditingId(null);
    resetEditor();
  };

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
    if (!name.trim()) {
      setError("Enter a name for this API configuration.");
      return null;
    }
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
    return { provider, apiKey: trimmedKey, modelId: trimmedModel };
  };

  const saveProfile = () => {
    const config = buildConfig();
    if (!config || config.provider === "anthropic") return;
    const profile: ApiConfigProfile = {
      id: editingProfile?.id ?? crypto.randomUUID(),
      name: name.trim().slice(0, 60),
      config,
    };
    if (editingProfile) {
      onUpdate(profile);
      toast.success(`${profile.name} updated`);
    } else {
      onCreate(profile);
      setEditingId(profile.id);
      toast.success(`${profile.name} added`);
    }
    setError(null);
  };

  const deleteProfile = (profile: ApiConfigProfile) => {
    if (deleteConfirmationId !== profile.id) {
      setDeleteConfirmationId(profile.id);
      return;
    }
    onDelete(profile.id);
    setDeleteConfirmationId(null);
    toast.success(`${profile.name} deleted`);
  };

  const fixedBaseUrl =
    provider === "kimi"
      ? KIMI_BASE_URL
      : provider === "deepseek"
        ? DEEPSEEK_BASE_URL
        : null;

  return (
    <section aria-labelledby="api-configuration-title" className="px-5 py-6 sm:px-7">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 id="api-configuration-title" className="text-sm font-semibold">
            API Configuration
          </h3>
          <p className="mt-1 text-[10px] text-zinc-500">
            Save multiple tab-scoped profiles, then choose one per Conversation.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewProfile}
          disabled={modelDisabled}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Add config
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="space-y-2">
          {projectClaudeAvailable ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold">Project Claude</p>
                  <p className="mt-0.5 text-[9px] text-zinc-500">Built in · server key</p>
                </div>
                {defaultConfigId === PROJECT_CLAUDE_CONFIG_ID ? (
                  <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-violet-400">Default</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetDefault(PROJECT_CLAUDE_CONFIG_ID)}
                    disabled={modelDisabled}
                    aria-label="Set Project Claude as default"
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800"
                  >
                    <Star className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {profiles.map((profile) => {
            const selected = editingId === profile.id;
            const confirmingDelete = deleteConfirmationId === profile.id;
            return (
              <div
                key={profile.id}
                className={cn(
                  "group rounded-xl border p-2.5 transition-colors",
                  selected
                    ? "border-violet-400/60 bg-violet-500/10"
                    : "border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => setEditingId(profile.id)}
                  className="w-full text-left"
                  aria-label={`Edit ${profile.name}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold">{profile.name}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-violet-400" /> : null}
                  </span>
                  <span className="mt-1 block truncate text-[9px] text-zinc-500">
                    {modelConfigLabel(profile.config)}
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-200/70 pt-2">
                  {defaultConfigId === profile.id ? (
                    <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-violet-400">Default</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetDefault(profile.id)}
                      disabled={modelDisabled}
                      className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-900"
                    >
                      <Star className="size-3" /> Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteProfile(profile)}
                    disabled={modelDisabled}
                    aria-label={`Delete ${profile.name}`}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] transition-colors",
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

          {profiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center">
              <KeyRound className="mx-auto size-4 text-zinc-400" />
              <p className="mt-2 text-[10px] leading-4 text-zinc-500">Add your first API configuration.</p>
            </div>
          ) : null}
        </div>

        <fieldset disabled={modelDisabled} className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api-config-name">Configuration name</Label>
              <Input
                id="api-config-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. DeepSeek work"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <select
                id="byok-provider"
                aria-label="Provider"
                value={provider}
                onChange={(event) => changeProvider(event.target.value as EditableProvider)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-violet-400"
              >
                <option value="anthropic-byok">Anthropic</option>
                <option value="kimi">Kimi</option>
                <option value="deepseek">DeepSeek</option>
                <option value="custom">OpenAI-compatible</option>
              </select>
            </div>
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
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {fixedBaseUrl ? (
            <div className="space-y-2">
              <Label>{provider === "kimi" ? "Kimi" : "DeepSeek"} Base URL</Label>
              <div className="flex h-9 items-center truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs text-zinc-600">
                {fixedBaseUrl}
              </div>
            </div>
          ) : null}

          <div className={cn("grid gap-3", provider === "custom" || provider === "kimi" ? "sm:grid-cols-2" : "grid-cols-1")}>
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
                placeholder={provider === "deepseek" ? DEFAULT_DEEPSEEK_MODEL_ID : "model-name"}
                spellCheck={false}
                className="font-mono"
              />
            </div>
            {provider === "kimi" ? (
              <div className="space-y-2">
                <Label htmlFor="kimi-reasoning-effort">Reasoning effort</Label>
                <select
                  id="kimi-reasoning-effort"
                  value={reasoningEffort}
                  onChange={(event) => setReasoningEffort(event.target.value as KimiReasoningEffort)}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-xs text-amber-300">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
            <div className="flex max-w-md gap-2 text-[10px] leading-4 text-emerald-400">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <p>Keys stay in this browser tab and are cleared when the tab closes.</p>
            </div>
            <button
              type="button"
              onClick={saveProfile}
              className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85"
            >
              {editingProfile ? "Save changes" : "Add configuration"}
            </button>
          </div>
        </fieldset>
      </div>

      {modelDisabled ? (
        <p className="mt-4 text-xs text-amber-300">API settings are locked while the agent is running.</p>
      ) : null}
    </section>
  );
}
