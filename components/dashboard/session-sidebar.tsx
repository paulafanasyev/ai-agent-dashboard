/**
 * File: components/dashboard/session-sidebar.tsx
 * Purpose: Render ordered desktop sessions in a user-resizable navigation column.
 * Problem solved: Keeps desktop status and controls compact by default while allowing more naming context on demand.
 */
"use client";

import { Plus } from "lucide-react";
import { DesktopSessionItem } from "@/components/dashboard/desktop-session-item";
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
