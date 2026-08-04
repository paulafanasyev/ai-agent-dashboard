/**
 * File: components/dashboard/agent-activity.tsx
 * Purpose: Present the agent's current observable activity and elapsed time.
 * Problem solved: Keeps users informed while the model plans or a tool executes without exposing hidden reasoning.
 */
"use client";

import { CircleAlert, LoaderCircle, TerminalSquare } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { describeAgentEvent, eventSurface } from "@/lib/dashboard/activity";
import type { AgentEvent, ConnectionStatus } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type ChatStatus = "error" | "submitted" | "streaming" | "ready";

interface AgentActivityProps {
  chatStatus: ChatStatus;
  connectionReady: boolean;
  connectionStatus: ConnectionStatus;
  events: AgentEvent[];
  queueCount: number;
}

function AgentActivityComponent({
  chatStatus,
  connectionReady,
  connectionStatus,
  events,
  queueCount,
}: AgentActivityProps) {
  const isBusy = chatStatus === "submitted" || chatStatus === "streaming";
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isBusy) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isBusy]);

  const pendingEvent = useMemo(
    () => events.findLast((event) => event.status === "pending") ?? null,
    [events],
  );
  const latestCompleted = useMemo(
    () => events.findLast((event) => event.status === "completed") ?? null,
    [events],
  );

  if (!connectionReady) {
    const connectionFailed =
      connectionStatus === "error" || connectionStatus === "offline";
    return (
      <ActivityShell
        title={
          connectionFailed
            ? "Desktop connection failed"
            : queueCount > 0
              ? "Waiting for Desktop"
              : "Starting the isolated desktop"
        }
        detail={
          connectionFailed
            ? "The remote runtime could not be reached. Use Reconnect in the Desktop header."
            : queueCount > 0
            ? `${queueCount} ${queueCount === 1 ? "task" : "tasks"} queued · Starts automatically when Ready`
            : "Preparing Chrome, VNC, and computer controls…"
        }
        elapsedSeconds={null}
        error={connectionFailed}
      />
    );
  }

  if (!isBusy) return null;

  if (pendingEvent) {
    const activity = describeAgentEvent(pendingEvent);
    return (
      <ActivityShell
        title={activity.title}
        detail={activity.detail}
        scope={eventSurface(pendingEvent)}
        elapsedSeconds={elapsedSeconds}
        terminal={pendingEvent.kind === "bash"}
      />
    );
  }

  const completedActivity = latestCompleted
    ? describeAgentEvent(latestCompleted)
    : null;
  const title =
    chatStatus === "submitted"
      ? "Understanding your task"
      : latestCompleted
        ? "Tool finished — planning the next step"
        : "Building an execution plan";
  const detail = completedActivity
    ? `Just completed: ${completedActivity.title}`
    : "The model is deciding which tool to use next…";

  return (
    <ActivityShell
      title={title}
      detail={detail}
      elapsedSeconds={elapsedSeconds}
    />
  );
}

/** Renders only when observable run, connection, event, or queue state changes. */
export const AgentActivity = memo(AgentActivityComponent);

function ActivityShell({
  title,
  detail,
  elapsedSeconds,
  terminal = false,
  error = false,
  scope,
}: {
  title: string;
  detail: string | null;
  elapsedSeconds: number | null;
  terminal?: boolean;
  error?: boolean;
  scope?: string;
}) {
  const Icon = error ? CircleAlert : terminal ? TerminalSquare : LoaderCircle;

  return (
    <section
      aria-live="polite"
      aria-label="Agent current activity"
      className="mx-3 mb-2 rounded-lg bg-zinc-100"
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-violet-600 shadow-sm">
          <Icon
            className={cn(
              "size-3.5",
              !terminal && !error && "animate-spin",
              error && "text-red-400",
            )}
          />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-zinc-100",
              error ? "bg-red-500" : "animate-pulse bg-emerald-500",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[11px] font-semibold text-zinc-800">{title}</p>
            {scope ? (
              <span className="hidden shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-violet-700 sm:inline">
                {scope}
              </span>
            ) : null}
          </div>
          {detail ? (
            <p className="truncate font-mono text-[9px] text-zinc-500">
              {detail}
            </p>
          ) : null}
        </div>
        {elapsedSeconds !== null ? (
          <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-400">
            {elapsedSeconds}s
          </span>
        ) : null}
      </div>
    </section>
  );
}
