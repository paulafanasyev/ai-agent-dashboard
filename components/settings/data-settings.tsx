/**
 * File: components/settings/data-settings.tsx
 * Purpose: Provide a deliberate, phrase-confirmed way to erase browser-local dashboard data.
 */
"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const DELETE_ALL_CONFIRMATION_PHRASE =
  "Delete all sessions and chats";

interface DataSettingsProps {
  disabled: boolean;
  onClearAllData: () => Promise<void>;
}

export function DataSettings({ disabled, onClearAllData }: DataSettingsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchesPhrase = confirmation === DELETE_ALL_CONFIRMATION_PHRASE;

  useEffect(() => {
    if (!isConfirming) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isClearing) setIsConfirming(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isClearing, isConfirming]);

  const closeConfirmation = () => {
    if (isClearing) return;
    setIsConfirming(false);
    setConfirmation("");
  };

  const confirmDeletion = async () => {
    if (!matchesPhrase || isClearing) return;
    setIsClearing(true);
    try {
      await onClearAllData();
      setIsConfirming(false);
      setConfirmation("");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <section
        aria-labelledby="data-settings-title"
        className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
      >
        <div className="mb-5">
          <h3 id="data-settings-title" className="text-sm font-semibold">
            Data and storage
          </h3>
          <p className="mt-1 text-[10px] text-zinc-500">
            Manage data saved by Agent Desk in this browser.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-red-500/25 bg-red-500/[0.04]">
          <div className="p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 className="size-5" />
            </span>
            <h4 className="mt-4 text-sm font-semibold text-zinc-900">
              Clear all cached data
            </h4>
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">
              Permanently removes every desktop session, conversation, message,
              event, API setting, theme preference, and tutorial state stored in
              this browser. Active remote desktops are stopped first.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-red-500/15 p-4 sm:p-5">
            <p className="text-[10px] leading-4 text-zinc-500">
              This action cannot be undone.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsConfirming(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-red-500 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Clear all data
            </button>
          </div>
        </div>

        {disabled ? (
          <p className="mt-3 text-xs text-amber-300">
            Stop the active agent run before clearing cached data.
          </p>
        ) : null}
      </section>

      {isConfirming ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeConfirmation();
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
            aria-describedby="clear-data-description"
            className="w-full max-w-md rounded-2xl border border-red-500/30 bg-surface p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle className="size-5" />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isClearing}
                onClick={closeConfirmation}
                aria-label="Cancel clearing data"
                className="-mr-2 -mt-2"
              >
                <X />
              </Button>
            </div>

            <h2 id="clear-data-title" className="mt-4 text-base font-semibold">
              Delete all sessions and chats?
            </h2>
            <p
              id="clear-data-description"
              className="mt-2 text-xs leading-5 text-zinc-500"
            >
              This permanently erases all locally stored Agent Desk data. To
              confirm, enter the exact phrase below.
            </p>

            <div className="mt-5 space-y-2">
              <Label htmlFor="clear-data-confirmation">
                Type <span className="font-mono text-zinc-900">{DELETE_ALL_CONFIRMATION_PHRASE}</span>
              </Label>
              <Input
                ref={inputRef}
                id="clear-data-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isClearing}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={confirmation.length > 0 && !matchesPhrase}
                className="font-mono"
              />
              <p aria-live="polite" className="min-h-4 text-[10px] text-red-400">
                {confirmation.length > 0 && !matchesPhrase
                  ? "The phrase must match exactly."
                  : ""}
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isClearing}
                onClick={closeConfirmation}
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={!matchesPhrase || isClearing}
                onClick={() => void confirmDeletion()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-red-500 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isClearing ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {isClearing ? "Clearing…" : "Delete everything"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
