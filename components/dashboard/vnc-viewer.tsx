/**
 * File: components/dashboard/vnc-viewer.tsx
 * Purpose: Embed and monitor the remote noVNC desktop stream.
 * Problem solved: Isolates desktop rendering from chat updates while supporting reconnectable sessions.
 */
"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  LoaderCircle,
  Maximize2,
  Minus,
  Monitor,
  MousePointer2,
  PictureInPicture2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";
import { describeAgentEvent, eventSurface } from "@/lib/dashboard/activity";
import type {
  AgentEvent,
  AgentStatus,
  ConnectionStatus,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface VncViewerProps {
  sessionId: string;
  sessionTitle: string;
  streamUrl: string | null;
  sandboxId: string | null;
  generation: number;
  connectionStatus: ConnectionStatus;
  agentStatus: AgentStatus;
  activityEvent: AgentEvent | null;
  displayMode: VncDisplayMode;
  showHeader?: boolean;
  onDisplayModeChange: (mode: VncDisplayMode) => void;
  onViewerStateChange: (sessionId: string, state: VncViewerState) => void;
  onRefresh: () => void;
}

export type VncDisplayMode = "embedded" | "minimized" | "pip";

export type VncViewerState =
  | "connecting"
  | "reconnecting"
  | "ready"
  | "offline";

function isVncStatusMessage(
  value: unknown,
): value is { source: "agent-dashboard-vnc"; state: VncViewerState } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === "agent-dashboard-vnc" &&
    (record.state === "connecting" ||
      record.state === "reconnecting" ||
      record.state === "ready" ||
      record.state === "offline")
  );
}

function VncViewerComponent({
  sessionId,
  sessionTitle,
  streamUrl,
  sandboxId,
  generation,
  connectionStatus,
  agentStatus,
  activityEvent,
  displayMode,
  showHeader = true,
  onDisplayModeChange,
  onViewerStateChange,
  onRefresh,
}: VncViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const [pipPosition, setPipPosition] = useState({ left: 12, top: 60 });

  useEffect(() => {
    if (!streamUrl) return;
    const expectedOrigin = new URL(streamUrl).origin;
    onViewerStateChange(sessionId, "connecting");

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== expectedOrigin ||
        event.source !== iframeRef.current?.contentWindow ||
        !isVncStatusMessage(event.data)
      ) {
        return;
      }
      onViewerStateChange(sessionId, event.data.state);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onViewerStateChange, sessionId, streamUrl]);

  useEffect(() => {
    if (displayMode !== "pip") return;
    const clampPosition = () => {
      const bounds = sectionRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setPipPosition((current) => ({
        left: Math.min(
          Math.max(8, current.left),
          Math.max(8, window.innerWidth - bounds.width - 8),
        ),
        top: Math.min(
          Math.max(52, current.top),
          Math.max(52, window.innerHeight - bounds.height - 8),
        ),
      }));
    };
    const frame = window.requestAnimationFrame(() => {
      const bounds = sectionRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setPipPosition((current) =>
        current.left === 12 && current.top === 60
          ? {
              left: Math.max(8, window.innerWidth - bounds.width - 12),
              top: 60,
            }
          : current,
      );
      clampPosition();
    });
    window.addEventListener("resize", clampPosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", clampPosition);
    };
  }, [displayMode]);

  const startPipDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      displayMode !== "pip" ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    ) {
      return;
    }
    const bounds = sectionRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragPip = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingDragPointRef.current = { x: event.clientX, y: event.clientY };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const point = pendingDragPointRef.current;
      const activeDrag = dragRef.current;
      if (!point || !activeDrag) return;
      setPipPosition({
        left: Math.min(
          Math.max(8, point.x - activeDrag.offsetX),
          Math.max(8, window.innerWidth - activeDrag.width - 8),
        ),
        top: Math.min(
          Math.max(52, point.y - activeDrag.offsetY),
          Math.max(52, window.innerHeight - activeDrag.height - 8),
        ),
      });
    });
  };

  const stopPipDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const drag = dragRef.current;
    setPipPosition({
      left: Math.min(
        Math.max(8, event.clientX - drag.offsetX),
        Math.max(8, window.innerWidth - drag.width - 8),
      ),
      top: Math.min(
        Math.max(52, event.clientY - drag.offsetY),
        Math.max(52, window.innerHeight - drag.height - 8),
      ),
    });
    pendingDragPointRef.current = null;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    },
    [],
  );

  const showFullHeader = displayMode === "pip" || showHeader;
  const showMinimizedDock = displayMode === "minimized" && showHeader;

  return (
    <section
      ref={sectionRef}
      style={displayMode === "pip" ? pipPosition : undefined}
      className={cn(
        "bg-black text-white",
        displayMode === "embedded" && "flex min-h-0 flex-1 flex-col",
        displayMode === "pip" &&
          "fixed z-[90] flex h-[min(320px,42dvh)] min-h-52 w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15",
        showMinimizedDock &&
          "fixed bottom-3 right-3 z-[90] flex h-10 w-[min(280px,calc(100vw-24px))] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15",
        displayMode === "minimized" && !showHeader && "hidden",
      )}
    >
      {showMinimizedDock ? (
        <header
          key="minimized-header"
          className="flex size-full items-center justify-between gap-2 px-2.5"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                connectionStatus === "ready" && "bg-emerald-400",
                (connectionStatus === "error" ||
                  connectionStatus === "offline") && "bg-red-400",
                connectionStatus !== "ready" &&
                  connectionStatus !== "error" &&
                  connectionStatus !== "offline" &&
                  "animate-pulse bg-amber-400",
              )}
            />
            <span className="truncate text-[11px] font-medium">
              {sessionTitle}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onDisplayModeChange("pip")}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Open desktop in picture in picture"
            >
              <PictureInPicture2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDisplayModeChange("embedded")}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Restore desktop"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </header>
      ) : showFullHeader ? (
        <header
          key="viewer-header"
          onPointerDown={startPipDrag}
          onPointerMove={dragPip}
          onPointerUp={stopPipDrag}
          onPointerCancel={stopPipDrag}
          className={cn(
            "flex h-11 shrink-0 items-center justify-between px-3 text-white",
            displayMode === "pip" &&
              "cursor-grab select-none touch-none active:cursor-grabbing",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Monitor className="size-3.5 text-zinc-500" />
            <span className="truncate text-[11px] font-medium">
              {sessionTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1.5 px-1 text-[9px] font-medium capitalize",
                connectionStatus === "ready"
                  ? "text-emerald-300"
                  : connectionStatus === "error" ||
                      connectionStatus === "offline"
                    ? "text-red-300"
                    : "text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  connectionStatus === "ready" && "bg-emerald-400",
                  (connectionStatus === "error" ||
                    connectionStatus === "offline") && "bg-red-400",
                  connectionStatus !== "ready" &&
                    connectionStatus !== "error" &&
                    connectionStatus !== "offline" &&
                    "animate-pulse bg-amber-400",
                )}
              />
              {connectionStatus}
            </span>
            {connectionStatus !== "creating" &&
            connectionStatus !== "checking" ? (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Reconnect desktop"
              >
                <RefreshCw className="size-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDisplayModeChange("minimized")}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Minimize desktop"
            >
              <Minus className="size-3.5" />
            </button>
            {displayMode === "pip" ? (
              <button
                type="button"
                onClick={() => onDisplayModeChange("embedded")}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Return desktop to workspace"
              >
                <Maximize2 className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDisplayModeChange("pip")}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Open desktop in picture in picture"
              >
                <PictureInPicture2 className="size-3.5" />
              </button>
            )}
          </div>
        </header>
      ) : null}

      <div
        key="desktop-surface"
        className={cn(
          "vnc-render-surface relative min-h-0 flex-1 overflow-hidden bg-[#171717]",
          displayMode === "minimized" && "hidden",
        )}
      >
        {streamUrl ? (
          <iframe
            ref={iframeRef}
            key={`${sandboxId ?? "sandbox"}-${generation}`}
            src={streamUrl}
            className="absolute inset-0 size-full border-0"
            allow="autoplay"
            title="Remote sandbox desktop"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-zinc-500">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-white/5">
              <Monitor className="size-4" />
              {connectionStatus === "creating" ? (
                <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full border-2 border-black bg-amber-400" />
              ) : null}
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium text-white/70">
                {connectionStatus === "error"
                  ? "Desktop connection failed"
                  : connectionStatus === "offline"
                    ? "Desktop is offline"
                    : connectionStatus === "checking"
                      ? "Checking desktop…"
                      : "Starting desktop…"}
              </p>
            </div>
          </div>
        )}
        {streamUrl && agentStatus !== "idle" ? (
          <DesktopActivityOverlay
            agentStatus={agentStatus}
            event={activityEvent}
          />
        ) : null}
      </div>
    </section>
  );
}

export const VncViewer = memo(
  VncViewerComponent,
  (previous, next) =>
    previous.sessionId === next.sessionId &&
    previous.sessionTitle === next.sessionTitle &&
    previous.streamUrl === next.streamUrl &&
    previous.sandboxId === next.sandboxId &&
    previous.generation === next.generation &&
    previous.connectionStatus === next.connectionStatus &&
    previous.agentStatus === next.agentStatus &&
    previous.displayMode === next.displayMode &&
    previous.showHeader === next.showHeader &&
    previous.activityEvent?.toolCallId === next.activityEvent?.toolCallId &&
    previous.activityEvent?.status === next.activityEvent?.status &&
    previous.onDisplayModeChange === next.onDisplayModeChange &&
    previous.onViewerStateChange === next.onViewerStateChange &&
    previous.onRefresh === next.onRefresh,
);

function DesktopActivityOverlay({
  agentStatus,
  event,
}: {
  agentStatus: AgentStatus;
  event: AgentEvent | null;
}) {
  const isExecuting = agentStatus === "executing" && event?.status === "pending";
  const activity = event ? describeAgentEvent(event) : null;
  const Icon = !isExecuting
    ? LoaderCircle
    : event.kind === "bash"
      ? TerminalSquare
      : MousePointer2;
  const title = isExecuting
    ? activity?.title ?? "Executing an action"
    : "Planning the next action";
  const detail = isExecuting
    ? activity?.detail
    : activity
      ? `Last action: ${activity.title}`
      : "The model is choosing the next tool.";
  const scope = isExecuting && event ? eventSurface(event) : "Agent planning";

  return (
    <div
      aria-live="polite"
      aria-label="Live agent desktop activity"
      className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-[min(92%,460px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/15 bg-black/90 px-3 py-2.5 text-white shadow-2xl backdrop-blur-md"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
        <Icon className={cn("size-4", !isExecuting && "animate-spin")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold">{title}</span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">
            {scope}
          </span>
        </span>
        {detail ? (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-400">
            {detail}
          </span>
        ) : null}
      </span>
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
    </div>
  );
}
