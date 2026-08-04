/**
 * File: components/dashboard/conversation-switcher.tsx
 * Purpose: Provide a styled, accessible conversation picker without a native select.
 * Problem solved: Makes conversation identity and state easier to scan while preserving compact dashboard navigation.
 */
"use client";

import {
  AlertTriangle,
  ChevronDown,
  MessageSquareText,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChatConversation } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface ConversationSwitcherProps {
  conversations: ChatConversation[];
  activeConversationId: string;
  disabled: boolean;
  onSelect: (conversationId: string) => void;
  onRename: (conversationId: string, name: string) => void;
  onDelete: (conversationId: string) => void;
}

function ConversationSwitcherComponent({
  conversations,
  activeConversationId,
  disabled,
  onSelect,
  onRename,
  onDelete,
}: ConversationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingConversation, setEditingConversation] =
    useState<ChatConversation | null>(null);
  const [deletingConversation, setDeletingConversation] =
    useState<ChatConversation | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const activeConversation =
    conversations.find((item) => item.id === activeConversationId) ??
    conversations[0];

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    const frame = window.requestAnimationFrame(() => selectedRef.current?.focus());
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
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="option"]',
      ),
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
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-label="Choose conversation"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex h-8 max-w-64 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "bg-surface shadow-sm",
        )}
      >
        <MessageSquareText className="size-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-800">
          {activeConversation?.title ?? "Conversation"}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-zinc-400 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Conversations"
          onKeyDown={moveOptionFocus}
          className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-5rem)] overflow-hidden rounded-xl bg-surface p-1.5 shadow-xl ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-semibold text-zinc-500">
              Conversations
            </span>
            <span className="text-[9px] tabular-nums text-zinc-400">
              {conversations.length}
            </span>
          </div>
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {conversations.map((conversation) => {
              const isSelected = conversation.id === activeConversationId;
              const messageCount = conversation.messages.length;
              const queueCount = conversation.queuedPrompts.length;
              return (
                <div
                  key={conversation.id}
                  role="presentation"
                  className="group/conversation relative rounded-lg"
                >
                  <button
                    ref={isSelected ? selectedRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isSelected) onSelect(conversation.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 pr-16 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-100",
                      isSelected && "bg-zinc-100",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-zinc-800">
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-zinc-400">
                        {messageCount}{" "}
                        {messageCount === 1 ? "message" : "messages"}
                        {queueCount > 0 ? ` · ${queueCount} queued` : ""}
                      </span>
                    </span>
                  </button>
                  <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover/conversation:pointer-events-auto group-hover/conversation:opacity-100 group-focus-within/conversation:pointer-events-auto group-focus-within/conversation:opacity-100">
                    <button
                      type="button"
                      aria-label={`Edit ${conversation.title}`}
                      onClick={() => {
                        setIsOpen(false);
                        setEditingConversation(conversation);
                      }}
                      className="flex size-6 items-center justify-center rounded-md bg-surface/90 text-zinc-400 shadow-sm transition-colors hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${conversation.title}`}
                      onClick={() => {
                        setIsOpen(false);
                        setDeletingConversation(conversation);
                      }}
                      className="flex size-6 items-center justify-center rounded-md bg-surface/90 text-zinc-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {editingConversation
        ? createPortal(
            <RenameConversationDialog
              conversation={editingConversation}
              existingNames={conversations
                .filter((item) => item.id !== editingConversation.id)
                .map((item) => item.title)}
              onCancel={() => setEditingConversation(null)}
              onRename={(name) => {
                onRename(editingConversation.id, name);
                setEditingConversation(null);
              }}
            />,
            document.body,
          )
        : null}

      {deletingConversation
        ? createPortal(
            <DeleteConversationDialog
              conversation={deletingConversation}
              onCancel={() => setDeletingConversation(null)}
              onDelete={() => {
                onDelete(deletingConversation.id);
                setDeletingConversation(null);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function RenameConversationDialog({
  conversation,
  existingNames,
  onCancel,
  onRename,
}: {
  conversation: ChatConversation;
  existingNames: string[];
  onCancel: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(conversation.title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.select());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel]);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a conversation name.");
      return;
    }
    if (trimmedName.length > 60) {
      setError("Keep the conversation name within 60 characters.");
      return;
    }
    if (
      existingNames.some(
        (existingName) =>
          existingName.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setError("A conversation with this name already exists.");
      return;
    }
    onRename(trimmedName);
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
        aria-labelledby="rename-conversation-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between px-5 pb-3 pt-5">
          <div>
            <h2 id="rename-conversation-title" className="text-sm font-semibold">
              Edit conversation
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Update how this conversation appears in the list.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close edit conversation dialog"
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
            <Label htmlFor="conversation-name">Conversation name</Label>
            <Input
              ref={inputRef}
              id="conversation-name"
              value={name}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "conversation-name-error" : undefined}
            />
            {error ? (
              <p id="conversation-name-error" className="text-xs text-red-600">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteConversationDialog({
  conversation,
  onCancel,
  onDelete,
}: {
  conversation: ChatConversation;
  onCancel: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

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
        aria-labelledby="delete-conversation-title"
        aria-describedby="delete-conversation-description"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-surface p-5 shadow-2xl"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="size-5" />
        </span>
        <h2 id="delete-conversation-title" className="mt-4 text-sm font-semibold">
          Delete conversation?
        </h2>
        <p
          id="delete-conversation-description"
          className="mt-2 text-xs leading-5 text-zinc-500"
        >
          “{conversation.title}” and its {conversation.messages.length}{" "}
          {conversation.messages.length === 1 ? "message" : "messages"} will be
          permanently removed.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            Delete conversation
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Keeps the accessible Conversation listbox stable during token-level message updates. */
export const ConversationSwitcher = memo(ConversationSwitcherComponent);
