/**
 * File: components/dashboard/conversation-switcher.tsx
 * Purpose: Provide a styled, accessible conversation picker without a native select.
 * Problem solved: Makes conversation identity and state easier to scan while preserving compact dashboard navigation.
 */
"use client";

import { Check, ChevronDown, MessageSquareText } from "lucide-react";
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ChatConversation } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface ConversationSwitcherProps {
  conversations: ChatConversation[];
  activeConversationId: string;
  disabled: boolean;
  onSelect: (conversationId: string) => void;
}

function ConversationSwitcherComponent({
  conversations,
  activeConversationId,
  disabled,
  onSelect,
}: ConversationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
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
                <button
                  ref={isSelected ? selectedRef : undefined}
                  key={conversation.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setIsOpen(false);
                    if (!isSelected) onSelect(conversation.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-100",
                    isSelected && "bg-zinc-100",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-zinc-800">
                      {conversation.title}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-zinc-400">
                      {messageCount} {messageCount === 1 ? "message" : "messages"}
                      {queueCount > 0 ? ` · ${queueCount} queued` : ""}
                    </span>
                  </span>
                  {isSelected ? (
                    <Check className="size-3.5 shrink-0 text-violet-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const ConversationSwitcher = memo(ConversationSwitcherComponent);
