/**
 * File: components/dashboard/desktop-session-item.tsx
 * Purpose: Render one desktop navigation row and action menu.
 * Problem solved: Keeps status, drag ordering, details, and contextual actions compact without overflowing the rail.
 */
"use client";

import { Monitor, MoreVertical, Pencil, Pin, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ChatSession } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export interface DesktopSessionItemProps {
  session: ChatSession;
  isActive: boolean;
  showTitle: boolean;
  showPinnedDivider: boolean;
  actionsDisabled: boolean;
  disabled: boolean;
  dragDisabled: boolean;
  isDragging: boolean;
  dropPosition: "before" | "after" | null;
  onDelete: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onKeyMove: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onRename: () => void;
  onSelect: (sessionId: string) => void;
  onTogglePin: () => void;
}

/** Combines selection, status, reorder, hover details, and contextual actions for one Desktop row. */
export function DesktopSessionItem({
  session,
  isActive,
  showTitle,
  showPinnedDivider,
  actionsDisabled,
  disabled,
  dragDisabled,
  isDragging,
  dropPosition,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onKeyMove,
  onRename,
  onSelect,
  onTogglePin,
}: DesktopSessionItemProps) {
  const desktopButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const closeMenu = () => setMenuPosition(null);
  const closeTooltip = () => setTooltipPosition(null);

  const showTooltip = () => {
    const bounds = desktopButtonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltipPosition({
      left: Math.min(bounds.right + 10, window.innerWidth - 250),
      top: Math.max(8, Math.min(bounds.top, window.innerHeight - 190)),
    });
  };

  const toggleMenu = () => {
    closeTooltip();
    if (menuPosition) {
      closeMenu();
      return;
    }
    const bounds = menuButtonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setMenuPosition({
      left: Math.min(bounds.right + 8, window.innerWidth - 168),
      top: Math.max(8, Math.min(bounds.top, window.innerHeight - 132)),
    });
  };

  useEffect(() => {
    if (!menuPosition) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuButtonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const closeOnViewportChange = () => closeMenu();
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [menuPosition]);

  useEffect(() => {
    if (actionsDisabled) closeMenu();
  }, [actionsDisabled]);

  useEffect(() => {
    if (!tooltipPosition) return;
    const closeOnViewportChange = () => closeTooltip();
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [tooltipPosition]);

  const tooltipId = `desktop-details-${session.id}`;

  return (
    <div className={cn("relative py-0.5", showPinnedDivider && "pb-2.5")}>
      <div
        className={cn(
          "group/session relative flex h-11 items-center gap-1 rounded-lg px-1 transition-colors",
          session.pinned
            ? "bg-violet-50/85"
            : "hover:bg-zinc-100/70",
          isDragging && "opacity-40",
        )}
      >
        {dropPosition ? (
          <span
            className={cn(
              "pointer-events-none absolute left-1 right-1 z-10 h-0.5 rounded-full bg-violet-500",
              dropPosition === "before" ? "-top-1" : "-bottom-1",
            )}
          />
        ) : null}
        <button
          ref={desktopButtonRef}
          type="button"
          draggable={!dragDisabled}
          onClick={() => onSelect(session.id)}
          onMouseEnter={showTooltip}
          onMouseLeave={closeTooltip}
          onFocus={showTooltip}
          onBlur={closeTooltip}
          onDragStart={(event) => {
            closeMenu();
            closeTooltip();
            onDragStart(event);
          }}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={onKeyMove}
          disabled={disabled}
          aria-label={`Switch to ${session.title}`}
          aria-describedby={tooltipPosition ? tooltipId : undefined}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40",
            dragDisabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900",
          )}
        >
          <Monitor className="size-3.5" />
          <span
            className={cn(
              "absolute bottom-1 right-1 size-1.5 rounded-full ring-2",
              isActive ? "ring-primary" : "ring-zinc-100",
              session.connectionStatus === "ready"
                ? "bg-emerald-500"
                : session.connectionStatus === "error" ||
                    session.connectionStatus === "offline"
                  ? "bg-red-500"
                  : session.connectionStatus === "uninitialized"
                    ? "bg-zinc-400"
                    : "bg-amber-400",
            )}
          />
        </button>

        {showTitle ? (
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-700">
            {session.title}
          </span>
        ) : null}

        <button
          ref={menuButtonRef}
          type="button"
          disabled={actionsDisabled}
          onClick={toggleMenu}
          aria-label={`Open actions for ${session.title}`}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuPosition)}
          className={cn(
            "absolute right-0.5 top-1/2 flex size-6 origin-left -translate-x-1.5 -translate-y-1/2 scale-75 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-[opacity,transform,background-color,color] duration-200 ease-out hover:bg-zinc-200 hover:text-zinc-800 focus-visible:translate-x-0 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-0 group-hover/session:translate-x-0 group-hover/session:scale-100 group-hover/session:opacity-100 group-focus-within/session:translate-x-0 group-focus-within/session:scale-100 group-focus-within/session:opacity-100",
            menuPosition &&
              "translate-x-0 scale-100 bg-zinc-200 text-zinc-800 opacity-100",
          )}
        >
          <MoreVertical className="size-3.5" />
        </button>
      </div>

      {showPinnedDivider ? (
        <div className="absolute bottom-1 left-1 right-1 h-px bg-violet-400/30" />
      ) : null}

      {tooltipPosition
        ? createPortal(
            <DesktopDetailsTooltip
              id={tooltipId}
              session={session}
              position={tooltipPosition}
            />,
            document.body,
          )
        : null}

      {menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`${session.title} actions`}
              style={menuPosition}
              className="fixed z-[100] w-40 animate-in fade-in slide-in-from-left-1 zoom-in-95 rounded-xl border border-zinc-200 bg-surface p-1.5 shadow-2xl duration-150"
            >
              <MenuAction
                icon={<Pin className="size-3.5" />}
                label={session.pinned ? "Unpin" : "Pin"}
                active={session.pinned}
                onClick={() => {
                  closeMenu();
                  onTogglePin();
                }}
              />
              <MenuAction
                icon={<Pencil className="size-3.5" />}
                label="Edit"
                onClick={() => {
                  closeMenu();
                  onRename();
                }}
              />
              <div className="my-1 h-px bg-zinc-200" />
              <MenuAction
                icon={<Trash2 className="size-3.5" />}
                label="Delete"
                destructive
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const connectionStatusLabels: Record<
  ChatSession["connectionStatus"],
  string
> = {
  uninitialized: "Not started",
  checking: "Checking",
  creating: "Starting",
  reconnecting: "Reconnecting",
  ready: "Ready",
  offline: "Offline",
  error: "Connection failed",
};

function DesktopDetailsTooltip({
  id,
  session,
  position,
}: {
  id: string;
  session: ChatSession;
  position: { left: number; top: number };
}) {
  const conversationCount = session.conversations.length;
  const updatedAt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(session.updatedAt);

  return (
    <div
      id={id}
      role="tooltip"
      aria-label={`${session.title} details`}
      style={position}
      className="pointer-events-none fixed z-[110] w-60 animate-in fade-in slide-in-from-left-1 zoom-in-95 rounded-xl border border-zinc-200 bg-surface p-3 shadow-2xl duration-150"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-xs font-semibold text-zinc-900">
          {session.title}
        </span>
        {session.pinned ? (
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
            Pinned
          </span>
        ) : null}
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[10px] leading-4">
        <dt className="text-zinc-400">Status</dt>
        <dd className="font-medium text-zinc-700">
          {connectionStatusLabels[session.connectionStatus]}
        </dd>
        <dt className="text-zinc-400">Conversations</dt>
        <dd className="font-medium text-zinc-700">{conversationCount}</dd>
        <dt className="text-zinc-400">Sandbox</dt>
        <dd className="font-medium text-zinc-700">
          {session.sandboxId ? "Allocated" : "Not allocated"}
        </dd>
        <dt className="text-zinc-400">Updated</dt>
        <dd className="font-medium text-zinc-700">{updatedAt}</dd>
      </dl>
    </div>
  );
}

function MenuAction({
  icon,
  label,
  active = false,
  destructive = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35",
        active && "bg-violet-50 text-violet-700",
        destructive && "text-red-400 hover:bg-red-950/60 hover:text-red-300",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
