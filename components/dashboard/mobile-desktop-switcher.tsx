/**
 * File: components/dashboard/mobile-desktop-switcher.tsx
 * Purpose: Provide compact desktop navigation above the mobile VNC workspace.
 * Problem solved: Keeps desktop identity, live readiness, switching, and creation visible without consuming the chat area.
 */
"use client";

import {
  Check,
  ChevronDown,
  Maximize2,
  Minus,
  Monitor,
  PictureInPicture2,
  Pin,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ChatSession, ConnectionStatus } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import type { VncDisplayMode } from "./vnc-viewer";

interface MobileDesktopSwitcherProps {
  sessions: ChatSession[];
  activeSessionId: string;
  disabled: boolean;
  displayMode: VncDisplayMode;
  onCreate: () => void;
  onDisplayModeChange: (mode: VncDisplayMode) => void;
  onRefresh: () => void;
  onSelect: (sessionId: string) => void;
}

function statusColor(status: ConnectionStatus) {
  if (status === "ready") return "bg-emerald-400";
  if (status === "error" || status === "offline") return "bg-red-400";
  if (status === "uninitialized") return "bg-zinc-500";
  return "animate-pulse bg-amber-400";
}

function MobileDesktopSwitcherComponent({
  sessions,
  activeSessionId,
  disabled,
  displayMode,
  onCreate,
  onDisplayModeChange,
  onRefresh,
  onSelect,
}: MobileDesktopSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

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
        '[role="option"]:not(:disabled)',
      ),
    );
    const currentIndex = options.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  if (!activeSession) return null;

  return (
    <div
      data-tutorial="desktop-nav"
      className="flex h-10 shrink-0 items-center justify-between bg-black px-2 text-white"
    >
      <div ref={rootRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Switch desktop. Current desktop: ${activeSession.title}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-8 w-full items-center gap-2 rounded-lg bg-white/10 px-2.5 text-left outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Monitor className="size-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
            {activeSession.title}
          </span>
          {activeSession.pinned ? (
            <Pin className="size-3 shrink-0 rotate-45 text-violet-300" />
          ) : null}
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              statusColor(activeSession.connectionStatus),
            )}
          />
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
            aria-label="Desktops"
            onKeyDown={moveOptionFocus}
            className="absolute left-0 top-full z-[95] mt-1.5 w-72 max-w-[calc(100vw-4rem)] overflow-hidden rounded-xl bg-surface p-1.5 text-zinc-900 shadow-2xl ring-1 ring-black/10"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] font-semibold text-zinc-500">
                Desktops
              </span>
              <span className="text-[9px] tabular-nums text-zinc-400">
                {sessions.length}
              </span>
            </div>
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {sessions.map((session) => {
                const isSelected = session.id === activeSessionId;
                return (
                  <button
                    ref={isSelected ? selectedRef : undefined}
                    key={session.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={disabled && !isSelected}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isSelected) onSelect(session.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40",
                      isSelected && "bg-zinc-100",
                    )}
                  >
                    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
                      <Monitor className="size-3.5" />
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-surface",
                          statusColor(session.connectionStatus),
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-zinc-800">
                        <span className="inline-flex max-w-full items-center gap-1.5">
                          <span className="truncate">{session.title}</span>
                          {session.pinned ? (
                            <Pin className="size-2.5 shrink-0 rotate-45 text-violet-600" />
                          ) : null}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[9px] capitalize text-zinc-400">
                        {session.connectionStatus} · {session.conversations.length}{" "}
                        {session.conversations.length === 1 ? "chat" : "chats"}
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

      <div className="ml-1 flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() =>
            onDisplayModeChange(
              displayMode === "minimized" ? "embedded" : "minimized",
            )
          }
          aria-label={
            displayMode === "minimized" ? "Restore desktop" : "Minimize desktop"
          }
          className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {displayMode === "minimized" ? (
            <Maximize2 className="size-3.5" />
          ) : (
            <Minus className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() =>
            onDisplayModeChange(displayMode === "pip" ? "embedded" : "pip")
          }
          aria-label={
            displayMode === "pip"
              ? "Return desktop to workspace"
              : "Open desktop in picture in picture"
          }
          className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {displayMode === "pip" ? (
            <Maximize2 className="size-3.5" />
          ) : (
            <PictureInPicture2 className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={
            disabled ||
            activeSession.connectionStatus === "creating" ||
            activeSession.connectionStatus === "checking"
          }
          aria-label="Reconnect current desktop"
          className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          aria-label="New desktop"
          className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export const MobileDesktopSwitcher = memo(
  MobileDesktopSwitcherComponent,
  (previous, next) =>
    previous.activeSessionId === next.activeSessionId &&
    previous.disabled === next.disabled &&
    previous.displayMode === next.displayMode &&
    previous.onCreate === next.onCreate &&
    previous.onDisplayModeChange === next.onDisplayModeChange &&
    previous.onRefresh === next.onRefresh &&
    previous.onSelect === next.onSelect &&
    previous.sessions.length === next.sessions.length &&
    previous.sessions.every((session, index) => {
      const candidate = next.sessions[index];
      return (
        session.id === candidate.id &&
        session.title === candidate.title &&
        session.pinned === candidate.pinned &&
        session.connectionStatus === candidate.connectionStatus &&
        session.conversations.length === candidate.conversations.length
      );
    }),
);
