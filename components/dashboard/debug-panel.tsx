/**
 * File: components/dashboard/debug-panel.tsx
 * Purpose: Display a collapsible chronological view of normalized agent events.
 * Problem solved: Makes tool activity and aggregate action counts inspectable during debugging.
 */
"use client";

import { ChevronDown, Database, TerminalSquare } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { eventCounts, eventLabel } from "@/lib/dashboard/events";
import type { AgentEvent } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface DebugPanelProps {
  events: AgentEvent[];
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

function DebugPanelComponent({
  events,
  selectedEventId,
  onSelectEvent,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const counts = useMemo(() => eventCounts(events), [events]);

  return (
    <section className="mx-3 mb-2 overflow-hidden rounded-lg bg-zinc-50">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <Database className="size-3.5" />
        <span>Events</span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">
          {events.length}
        </span>
        <div className="ml-auto">
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      {isOpen ? (
        <div className="max-h-48 overflow-y-auto bg-black px-3 py-2 font-mono text-[11px] text-white/65">
          {Object.keys(counts).length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
              {Object.entries(counts).map(([key, count]) => (
                <span
                  key={key}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-zinc-400"
                >
                  {key} {count}
                </span>
              ))}
            </div>
          ) : null}
          {events.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-zinc-500">
              <TerminalSquare className="size-3.5" />
              Tool events will appear here.
            </div>
          ) : (
            events.map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => onSelectEvent?.(event.id)}
                aria-pressed={selectedEventId === event.id}
                className={cn(
                  "grid w-full grid-cols-[64px_1fr_auto] gap-2 border-b border-white/5 py-1.5 text-left last:border-0",
                  onSelectEvent && "hover:text-white",
                  selectedEventId === event.id && "text-violet-300",
                )}
              >
                <span className="text-zinc-500">
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="truncate text-white/75">
                  {event.kind}.{eventLabel(event).toLowerCase().replaceAll(" ", "_")}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase",
                    event.status === "completed" && "text-emerald-400",
                    event.status === "pending" && "text-amber-400",
                    event.status === "error" && "text-red-400",
                    event.status === "cancelled" && "text-zinc-500",
                  )}
                >
                  {event.status}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

export const DebugPanel = memo(DebugPanelComponent);
