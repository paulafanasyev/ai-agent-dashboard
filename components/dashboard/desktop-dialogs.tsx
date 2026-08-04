/**
 * File: components/dashboard/desktop-dialogs.tsx
 * Purpose: Confirm desktop creation, renaming, and destructive deletion.
 * Problem solved: Gives desktops intentional identities while preventing accidental runtime changes and data loss.
 */
"use client";

import { AlertTriangle, Monitor, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChatSession } from "@/lib/dashboard/types";

export const DEFAULT_DESKTOP_NAME = "Desktop 123";

interface CreateDesktopDialogProps {
  open: boolean;
  existingNames: string[];
  onCancel: () => void;
  onCreate: (name: string) => void;
}

export function CreateDesktopDialog({
  open,
  existingNames,
  onCancel,
  onCreate,
}: CreateDesktopDialogProps) {
  const [name, setName] = useState(DEFAULT_DESKTOP_NAME);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(DEFAULT_DESKTOP_NAME);
    setError(null);
    const frame = window.requestAnimationFrame(() => inputRef.current?.select());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, open]);

  if (!open) return null;

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a desktop name.");
      return;
    }
    if (trimmedName.length > 40) {
      setError("Keep the desktop name within 40 characters.");
      return;
    }
    if (
      existingNames.some(
        (existingName) =>
          existingName.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setError("A desktop with this name already exists.");
      return;
    }
    onCreate(trimmedName);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-desktop-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between px-5 pb-3 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Monitor className="size-4" />
            </span>
            <div>
              <h2 id="create-desktop-title" className="text-sm font-semibold">
                Create desktop
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Name this isolated workspace before starting it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close create desktop dialog"
            className="-mr-1 -mt-1 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-4 px-5 pb-5"
        >
          <div className="space-y-2">
            <Label htmlFor="desktop-name">Desktop name</Label>
            <Input
              ref={inputRef}
              id="desktop-name"
              value={name}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "desktop-name-error" : undefined}
            />
            {error ? (
              <p id="desktop-name-error" className="text-xs text-red-600">
                {error}
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400">
                Default: {DEFAULT_DESKTOP_NAME}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus />
              Create desktop
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface RenameDesktopDialogProps {
  session: ChatSession | null;
  existingNames: string[];
  onCancel: () => void;
  onRename: (sessionId: string, name: string) => void;
}

export function RenameDesktopDialog({
  session,
  existingNames,
  onCancel,
  onRename,
}: RenameDesktopDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    setName(session.title);
    setError(null);
    const frame = window.requestAnimationFrame(() => inputRef.current?.select());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, session]);

  if (!session) return null;

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a desktop name.");
      return;
    }
    if (trimmedName.length > 40) {
      setError("Keep the desktop name within 40 characters.");
      return;
    }
    if (
      existingNames.some(
        (existingName) =>
          existingName.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setError("A desktop with this name already exists.");
      return;
    }
    onRename(session.id, trimmedName);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-desktop-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between px-5 pb-3 pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Monitor className="size-4" />
            </span>
            <div>
              <h2 id="rename-desktop-title" className="text-sm font-semibold">
                Rename desktop
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Use a clear name for this workspace and its conversations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close rename desktop dialog"
            className="-mr-1 -mt-1 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-4 px-5 pb-5"
        >
          <div className="space-y-2">
            <Label htmlFor="rename-desktop-name">Desktop name</Label>
            <Input
              ref={inputRef}
              id="rename-desktop-name"
              value={name}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "rename-desktop-name-error" : undefined}
            />
            {error ? (
              <p id="rename-desktop-name-error" className="text-xs text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save name</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface DeleteDesktopDialogProps {
  session: ChatSession | null;
  onCancel: () => void;
  onConfirm: (sessionId: string) => void;
}

export function DeleteDesktopDialog({
  session,
  onCancel,
  onConfirm,
}: DeleteDesktopDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!session) return;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, session]);

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-desktop-title"
        aria-describedby="delete-desktop-description"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-surface p-5 shadow-2xl"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-red-950/60 text-red-300">
          <AlertTriangle className="size-4.5" />
        </span>
        <h2 id="delete-desktop-title" className="mt-4 text-sm font-semibold">
          Delete {session.title}?
        </h2>
        <p
          id="delete-desktop-description"
          className="mt-2 text-xs leading-5 text-zinc-500"
        >
          This closes its remote runtime and permanently removes all local
          conversations, queued prompts, and event history.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(session.id)}
          >
            <Trash2 />
            Delete desktop
          </Button>
        </div>
      </section>
    </div>
  );
}

interface DesktopDialogStackProps {
  sessions: ChatSession[];
  createOpen: boolean;
  deleteSessionId: string | null;
  renameSessionId: string | null;
  onCloseCreate: () => void;
  onCreate: (name: string) => void;
  onCloseDelete: () => void;
  onDelete: (sessionId: string) => void;
  onCloseRename: () => void;
  onRename: (sessionId: string, name: string) => void;
}

export function DesktopDialogStack({
  sessions,
  createOpen,
  deleteSessionId,
  renameSessionId,
  onCloseCreate,
  onCreate,
  onCloseDelete,
  onDelete,
  onCloseRename,
  onRename,
}: DesktopDialogStackProps) {
  const deleteSession =
    sessions.find((session) => session.id === deleteSessionId) ?? null;
  const renameSession =
    sessions.find((session) => session.id === renameSessionId) ?? null;

  return (
    <>
      <CreateDesktopDialog
        open={createOpen}
        existingNames={sessions.map((session) => session.title)}
        onCancel={onCloseCreate}
        onCreate={onCreate}
      />
      <DeleteDesktopDialog
        session={deleteSession}
        onCancel={onCloseDelete}
        onConfirm={onDelete}
      />
      <RenameDesktopDialog
        session={renameSession}
        existingNames={sessions
          .filter((session) => session.id !== renameSessionId)
          .map((session) => session.title)}
        onCancel={onCloseRename}
        onRename={onRename}
      />
    </>
  );
}
