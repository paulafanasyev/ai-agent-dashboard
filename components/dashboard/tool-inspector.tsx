/**
 * File: components/dashboard/tool-inspector.tsx
 * Purpose: Show expanded details for the selected computer or Bash event.
 * Problem solved: Turns compact chat tool cards into inspectable screenshots, commands, outputs, and targets.
 */
"use client";

import {
  CheckCircle2,
  Clipboard,
  Clock3,
  Code2,
  Crosshair,
  ImageIcon,
  MousePointer2,
  TerminalSquare,
} from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { eventSurface } from "@/lib/dashboard/activity";
import { eventLabel } from "@/lib/dashboard/events";
import type { AgentEvent } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

function ToolInspectorComponent({
  event,
  fill = false,
}: {
  event: AgentEvent | null;
  fill?: boolean;
}) {
  const copyEvent = async () => {
    if (!event) return;
    await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    toast.success("Event JSON copied");
  };

  return (
    <section
      className={cn(
        "flex shrink-0 flex-col border-t border-zinc-100 bg-surface",
        fill ? "min-h-0 flex-1" : "h-[240px]",
      )}
    >
      <header className="flex h-10 shrink-0 items-center justify-between bg-zinc-50/70 px-3">
        <div className="flex items-center gap-2">
          <Crosshair className="size-3.5 text-zinc-400" />
          <h2 className="text-[11px] font-semibold text-zinc-700">Inspector</h2>
        </div>
        {event ? (
          <button
            type="button"
            onClick={copyEvent}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <Clipboard className="size-3" />
            Copy JSON
          </button>
        ) : null}
      </header>

      {!event ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-zinc-400">
          <MousePointer2 className="size-4" />
          <p className="text-[11px]">Select an action for details</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {eventSurface(event)}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-zinc-900">
                {eventLabel(event)}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium",
                  event.status === "completed" &&
                    "bg-emerald-950/60 text-emerald-300",
                  event.status === "pending" &&
                    "bg-amber-950/60 text-amber-300",
                  event.status === "error" && "bg-red-950/60 text-red-300",
                  event.status === "cancelled" && "bg-zinc-100 text-zinc-600",
                )}
              >
                <CheckCircle2 className="size-3" />
                {event.status}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                <Clock3 className="size-3" />
                {event.durationMs === null ? "—" : `${event.durationMs} ms`}
              </span>
            </div>
          </div>

          {event.kind === "bash" ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  <Code2 className="size-3" /> Command
                </p>
                <pre className="overflow-x-auto rounded-lg bg-black p-3 font-mono text-[11px] text-white/75">
                  $ {event.payload.command}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  <TerminalSquare className="size-3" /> Output
                </p>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-600">
                  {event.result?.output ?? "Waiting for command output…"}
                </pre>
              </div>
            </div>
          ) : event.result?.type === "image" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${event.result.data}`}
                alt="Full computer screenshot"
                decoding="async"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-100"
              />
              <dl className="space-y-2 text-[11px]">
                <div className="rounded-lg bg-zinc-50 p-2.5">
                  <dt className="flex items-center gap-1.5 text-zinc-400">
                    <ImageIcon className="size-3" /> Resolution
                  </dt>
                  <dd className="mt-1 font-mono text-zinc-700">1024 × 768</dd>
                </div>
                <div className="rounded-lg bg-zinc-50 p-2.5">
                  <dt className="text-zinc-400">Captured</dt>
                  <dd className="mt-1 font-mono text-zinc-700">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Action" value={event.action} />
              <Detail
                label="Target"
                value={
                  event.payload.coordinate
                    ? `${event.payload.coordinate[0]}, ${event.payload.coordinate[1]} · coordinate-only`
                    : "No coordinate target"
                }
              />
              {event.payload.text ? (
                <Detail label="Input" value={event.payload.text} />
              ) : null}
              {event.payload.scrollDirection ? (
                <Detail
                  label="Scroll"
                  value={`${event.payload.scrollDirection} · ${event.payload.scrollAmount ?? 0}`}
                />
              ) : null}
              {event.result?.type === "text" ? (
                <Detail label="Result" value={event.result.text} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const ToolInspector = memo(ToolInspectorComponent);

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mt-1 break-words font-mono text-[11px] text-zinc-700">
        {value}
      </p>
    </div>
  );
}
