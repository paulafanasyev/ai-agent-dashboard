/**
 * File: components/dashboard/session-sidebar.tsx
 * Purpose: Render ordered desktop sessions in a user-resizable navigation column.
 * Problem solved: Keeps desktop status and controls compact by default while allowing more naming context on demand.
 */
"use client";

import {
  Monitor,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { ChatSession } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_STORAGE_KEY = "agent-desk-sidebar-width";
const COMPACT_SIDEBAR_WIDTH = 96;
const MIN_SIDEBAR_WIDTH = 84;
const MAX_SIDEBAR_WIDTH = 240;
const LABEL_SIDEBAR_WIDTH = 148;

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  disabled: boolean;
  settingsControl: ReactNode;
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  onRequestDelete: (sessionId: string) => void;
  onRequestRename: (sessionId: string) => void;
  onTogglePin: (sessionId: string) => void;
  onReorder: (
    draggedSessionId: string,
    targetSessionId: string,
    position: "before" | "after",
  ) => void;
}

function SessionSidebarComponent({
  sessions,
  activeSessionId,
  disabled,
  settingsControl,
  onCreate,
  onSelect,
  onRequestDelete,
  onRequestRename,
  onTogglePin,
  onReorder,
}: SessionSidebarProps) {
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    sessionId: string;
    position: "before" | "after";
  } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(COMPACT_SIDEBAR_WIDTH);
  const sidebarWidthRef = useRef(COMPACT_SIDEBAR_WIDTH);
  const resizeFrameRef = useRef<number | null>(null);
  const pendingResizeXRef = useRef<number | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    if (!Number.isFinite(storedWidth)) return;
    const nextWidth = Math.max(
      MIN_SIDEBAR_WIDTH,
      Math.min(MAX_SIDEBAR_WIDTH, storedWidth),
    );
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
  }, []);

  const persistSidebarWidth = (width: number) => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(width)));
  };

  const applySidebarResize = (clientX: number) => {
    const resize = resizeRef.current;
    if (!resize) return;
    const nextWidth = Math.max(
      MIN_SIDEBAR_WIDTH,
      Math.min(
        MAX_SIDEBAR_WIDTH,
        resize.startWidth + clientX - resize.startX,
      ),
    );
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
  };

  const resizeSidebar = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    pendingResizeXRef.current = event.clientX;
    if (resizeFrameRef.current !== null) return;
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      if (pendingResizeXRef.current !== null) {
        applySidebarResize(pendingResizeXRef.current);
      }
    });
  };

  const finishSidebarResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    applySidebarResize(event.clientX);
    pendingResizeXRef.current = null;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistSidebarWidth(sidebarWidthRef.current);
  };

  useEffect(
    () => () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
    },
    [],
  );

  const resetDragState = () => {
    setDraggedSessionId(null);
    setDropTarget(null);
  };

  const startDrag = (event: DragEvent<HTMLButtonElement>, sessionId: string) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sessionId);
    setDraggedSessionId(sessionId);
    setDropTarget(null);
  };

  const targetDrag = (
    event: DragEvent<HTMLButtonElement>,
    sessionId: string,
  ) => {
    if (!draggedSessionId || draggedSessionId === sessionId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({
      sessionId,
      position:
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
    });
  };

  const dropOnSession = (
    event: DragEvent<HTMLButtonElement>,
    targetSessionId: string,
  ) => {
    event.preventDefault();
    const draggedId =
      draggedSessionId ?? event.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== targetSessionId) {
      onReorder(
        draggedId,
        targetSessionId,
        dropTarget?.sessionId === targetSessionId
          ? dropTarget.position
          : "before",
      );
    }
    resetDragState();
  };

  const moveWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    sessionId: string,
    index: number,
  ) => {
    if (disabled) return;
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    const target = sessions[index + direction];
    if (!target) return;
    onReorder(sessionId, target.id, direction < 0 ? "before" : "after");
  };

  const showLabels = sidebarWidth >= LABEL_SIDEBAR_WIDTH;

  return (
    <aside
      data-tutorial="desktop-nav"
      style={{ width: sidebarWidth }}
      className="relative flex shrink-0 flex-col overflow-hidden border-r border-zinc-100 bg-zinc-50/70"
    >
      <div className="flex h-12 items-center px-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          aria-label="New desktop"
          title="New desktop"
          className="flex h-8 w-full items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          {showLabels ? <span className="ml-1 text-[10px]">New desktop</span> : null}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const showPinnedDivider =
            session.pinned && !sessions[index + 1]?.pinned;
          return (
            <DesktopSessionItem
              key={session.id}
              session={session}
              isActive={isActive}
              showTitle={showLabels}
              showPinnedDivider={showPinnedDivider}
              actionsDisabled={disabled}
              disabled={disabled && !isActive}
              dragDisabled={disabled}
              isDragging={draggedSessionId === session.id}
              dropPosition={
                dropTarget?.sessionId === session.id
                  ? dropTarget.position
                  : null
              }
              onDelete={() => onRequestDelete(session.id)}
              onDragEnd={resetDragState}
              onDragOver={(event) => targetDrag(event, session.id)}
              onDragStart={(event) => startDrag(event, session.id)}
              onDrop={(event) => dropOnSession(event, session.id)}
              onKeyMove={(event) => moveWithKeyboard(event, session.id, index)}
              onRename={() => onRequestRename(session.id)}
              onSelect={onSelect}
              onTogglePin={() => onTogglePin(session.id)}
            />
          );
        })}
      </nav>

      <div className="border-t border-zinc-100 px-2 py-2">
        {settingsControl}
      </div>

      <button
        type="button"
        aria-label="Resize Desktop column"
        onPointerDown={(event) => {
          resizeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: sidebarWidth,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={resizeSidebar}
        onPointerUp={finishSidebarResize}
        onPointerCancel={finishSidebarResize}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const direction = event.key === "ArrowLeft" ? -8 : 8;
          setSidebarWidth((current) => {
            const next = Math.max(
              MIN_SIDEBAR_WIDTH,
              Math.min(MAX_SIDEBAR_WIDTH, current + direction),
            );
            sidebarWidthRef.current = next;
            persistSidebarWidth(next);
            return next;
          });
        }}
        className="group absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize touch-none outline-none"
      >
        <span className="absolute inset-y-0 right-0 w-px bg-transparent transition-colors group-hover:bg-violet-400 group-focus-visible:bg-violet-400" />
      </button>
    </aside>
  );
}

function sessionNavigationEqual(
  previous: ChatSession[],
  next: ChatSession[],
) {
  return (
    previous.length === next.length &&
    previous.every((session, index) => {
      const candidate = next[index];
      return (
        session.id === candidate.id &&
        session.title === candidate.title &&
        session.pinned === candidate.pinned &&
        session.connectionStatus === candidate.connectionStatus &&
        session.conversations.length === candidate.conversations.length
      );
    })
  );
}

export const SessionSidebar = memo(
  SessionSidebarComponent,
  (previous, next) =>
    previous.activeSessionId === next.activeSessionId &&
    previous.disabled === next.disabled &&
    previous.settingsControl === next.settingsControl &&
    previous.onCreate === next.onCreate &&
    previous.onSelect === next.onSelect &&
    previous.onRequestDelete === next.onRequestDelete &&
    previous.onRequestRename === next.onRequestRename &&
    previous.onTogglePin === next.onTogglePin &&
    previous.onReorder === next.onReorder &&
    sessionNavigationEqual(previous.sessions, next.sessions),
);

interface DesktopSessionItemProps {
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

function DesktopSessionItem({
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
  const rowRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [infoPosition, setInfoPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const closeMenu = () => setMenuPosition(null);

  const showInfo = () => {
    if (menuPosition || isDragging) return;
    const bounds = rowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setInfoPosition({
      left: Math.min(bounds.right + 8, window.innerWidth - 208),
      top: Math.max(8, Math.min(bounds.top, window.innerHeight - 76)),
    });
  };

  const toggleMenu = () => {
    if (menuPosition) {
      closeMenu();
      return;
    }
    const bounds = menuButtonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setInfoPosition(null);
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

  return (
    <div className={cn("relative py-0.5", showPinnedDivider && "pb-2.5")}>
      <div
        ref={rowRef}
        className={cn(
          "relative flex h-11 items-center gap-1 rounded-lg px-1 transition-colors",
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
          type="button"
          draggable={!dragDisabled}
          onClick={() => onSelect(session.id)}
          onDragStart={(event) => {
            setInfoPosition(null);
            closeMenu();
            onDragStart(event);
          }}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={onKeyMove}
          onMouseEnter={showInfo}
          onMouseLeave={() => setInfoPosition(null)}
          onFocus={showInfo}
          onBlur={() => setInfoPosition(null)}
          disabled={disabled}
          aria-label={`Switch to ${session.title}`}
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
            "mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-35",
            menuPosition && "bg-zinc-200 text-zinc-800",
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {showPinnedDivider ? (
        <div className="absolute bottom-1 left-1 right-1 h-px bg-violet-400/30" />
      ) : null}

      {infoPosition && !isDragging
        ? createPortal(
            <div
              role="tooltip"
              style={infoPosition}
              className="pointer-events-none fixed z-[95] w-48 animate-in fade-in slide-in-from-left-1 rounded-xl border border-zinc-200 bg-surface/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl duration-150"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-900">
                  {session.title}
                </span>
                {session.pinned ? (
                  <Pin className="size-3 shrink-0 rotate-45 text-violet-500" />
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[9px] capitalize text-zinc-500">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
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
                <span>{session.connectionStatus}</span>
                <span className="text-zinc-300">·</span>
                <span>
                  {session.conversations.length}{" "}
                  {session.conversations.length === 1 ? "chat" : "chats"}
                </span>
              </div>
            </div>,
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
