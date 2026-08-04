/**
 * File: components/message.tsx
 * Purpose: Render streaming chat messages, copyable text, and interactive inline tool-call cards.
 * Problem solved: Makes conversation content reusable and computer or Bash actions understandable without leaving the timeline.
 */
"use client";

import type { Message } from "ai";
import equal from "fast-deep-equal";
import {
  Camera,
  Check,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Code2,
  Copy,
  Keyboard,
  Loader2,
  MousePointer2,
  ScrollText,
  StopCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { ABORTED, cn } from "@/lib/utils";

interface PreviewMessageProps {
  message: Message;
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function numberValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "number" ? record[key] : undefined;
}

function coordinateValue(record: Record<string, unknown>, key: string) {
  const coordinate = record[key];
  return Array.isArray(coordinate) &&
    coordinate.length === 2 &&
    typeof coordinate[0] === "number" &&
    typeof coordinate[1] === "number"
    ? `(${coordinate[0]}, ${coordinate[1]})`
    : undefined;
}

function messageContainsToolCall(message: Message, toolCallId?: string | null) {
  if (!toolCallId) return false;
  return message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolCallId === toolCallId,
  );
}

function actionPresentation(args: Record<string, unknown>): {
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
} {
  const action = stringValue(args, "action") ?? "computer action";
  const coordinate = coordinateValue(args, "coordinate");
  const text = stringValue(args, "text");

  switch (action) {
    case "screenshot":
      return { label: "Screenshot", detail: "1024 × 768", icon: Camera };
    case "left_click":
      return { label: "Left click", detail: coordinate ?? "", icon: MousePointer2 };
    case "right_click":
      return { label: "Right click", detail: coordinate ?? "", icon: MousePointer2 };
    case "double_click":
      return { label: "Double click", detail: coordinate ?? "", icon: MousePointer2 };
    case "mouse_move":
      return { label: "Move cursor", detail: coordinate ?? "", icon: MousePointer2 };
    case "type":
      return { label: "Type", detail: text ? `“${text}”` : "", icon: Keyboard };
    case "key":
      return { label: "Press key", detail: text ?? "", icon: Keyboard };
    case "wait":
      return {
        label: "Wait",
        detail: `${numberValue(args, "duration") ?? 0}s`,
        icon: Clock3,
      };
    case "scroll":
      return {
        label: "Scroll",
        detail: `${stringValue(args, "scroll_direction") ?? ""} ${numberValue(args, "scroll_amount") ?? ""}`.trim(),
        icon: ScrollText,
      };
    default:
      return {
        label: action.replaceAll("_", " "),
        detail: coordinate ?? "",
        icon: MousePointer2,
      };
  }
}

function ToolStatusIcon({
  state,
  result,
  isActive,
}: {
  state: string;
  result: unknown;
  isActive: boolean;
}) {
  if (state === "call") {
    return isActive ? (
      <Loader2 className="size-4 animate-spin text-amber-500" />
    ) : (
      <StopCircle className="size-4 text-red-500" />
    );
  }
  if (result === ABORTED) return <CircleSlash className="size-4 text-zinc-400" />;
  return <CheckCircle2 className="size-4 text-emerald-500" />;
}

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
  selectedEventId,
  onSelectEvent,
}: PreviewMessageProps) => {
  const [copiedPartKey, setCopiedPartKey] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const renderStreamingTextPlainly =
    isLatestMessage &&
    message.role === "assistant" &&
    (status === "submitted" || status === "streaming");

  useEffect(
    () => () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    },
    [],
  );

  const copyText = async (text: string, partKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      setCopiedPartKey(partKey);
      toast.success("Copied to clipboard");
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedPartKey(null);
        copyFeedbackTimerRef.current = null;
      }, 1600);
    } catch {
      toast.error("Could not copy this message");
    }
  };

  return (
    <AnimatePresence key={message.id}>
      <motion.article
        className="chat-message group/message mx-auto w-full"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex w-full gap-3 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:w-fit group-data-[role=user]/message:max-w-[88%]",
          )}
        >
          <div className="flex w-full min-w-0 flex-col">
            {message.parts?.map((part, index) => {
              if (part.type === "text") {
                const partKey = `${message.id}-text-${index}`;
                return (
                  <motion.div
                    initial={{ y: 4, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    key={partKey}
                    className={cn(
                      "group/copy mb-3 flex w-full items-start gap-2",
                      message.role === "user" && "justify-end",
                    )}
                  >
                    {message.role === "user" ? (
                      <CopyTextButton
                        copied={copiedPartKey === partKey}
                        onClick={() => void copyText(part.text, partKey)}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "min-w-0 text-sm leading-6 text-zinc-700",
                        message.role === "user" &&
                          "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground",
                      )}
                    >
                      {renderStreamingTextPlainly ? (
                        <p className="whitespace-pre-wrap break-words">
                          {part.text}
                        </p>
                      ) : (
                        <Streamdown>{part.text}</Streamdown>
                      )}
                    </div>
                    {message.role !== "user" ? (
                      <CopyTextButton
                        copied={copiedPartKey === partKey}
                        onClick={() => void copyText(part.text, partKey)}
                      />
                    ) : null}
                  </motion.div>
                );
              }

              if (part.type !== "tool-invocation") return null;

              const { toolName, toolCallId, state } = part.toolInvocation;
              const rawArgs: unknown = part.toolInvocation.args;
              const args = isRecord(rawArgs) ? rawArgs : {};
              const result: unknown =
                state === "result" ? part.toolInvocation.result : undefined;
              const isActive = isLatestMessage && status !== "ready";

              if (toolName === "computer") {
                const presentation = actionPresentation(args);
                const ActionIcon = presentation.icon;
                const imageData =
                  isRecord(result) &&
                  result.type === "image" &&
                  typeof result.data === "string"
                    ? result.data
                    : null;

                return (
                  <motion.button
                    type="button"
                    initial={{ y: 4, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    key={toolCallId}
                    onClick={() => onSelectEvent?.(toolCallId)}
                    className={cn(
                      "mb-3 w-full overflow-hidden rounded-xl border bg-surface text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow-md",
                      selectedEventId === toolCallId
                        ? "border-violet-400 ring-2 ring-violet-100"
                        : "border-zinc-200",
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <ActionIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-800">
                            {presentation.label}
                          </span>
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-700">
                            Visible desktop action
                          </span>
                        </span>
                        {presentation.detail ? (
                          <span className="block truncate font-mono text-[11px] text-zinc-500">
                            {presentation.detail}
                          </span>
                        ) : null}
                      </span>
                      <ToolStatusIcon state={state} result={result} isActive={isActive} />
                    </div>
                    {imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${imageData}`}
                        alt="Computer screenshot"
                        loading="lazy"
                        decoding="async"
                        className="aspect-[16/8] w-full border-t border-zinc-200 object-cover object-top"
                      />
                    ) : state === "call" && stringValue(args, "action") === "screenshot" ? (
                      <div className="aspect-[16/8] w-full animate-pulse border-t border-zinc-200 bg-zinc-100" />
                    ) : null}
                  </motion.button>
                );
              }

              if (toolName === "bash") {
                const command = stringValue(args, "command") ?? "";
                const output = typeof result === "string" ? result : null;
                return (
                  <motion.button
                    type="button"
                    initial={{ y: 4, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    key={toolCallId}
                    onClick={() => onSelectEvent?.(toolCallId)}
                    className={cn(
                      "mb-3 w-full overflow-hidden rounded-xl border bg-black text-left text-white shadow-sm transition-all hover:border-white/30",
                      selectedEventId === toolCallId
                        ? "border-violet-400 ring-2 ring-violet-100"
                        : "border-white/10",
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
                        <Code2 className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-white/50">
                          Bash · Background command
                        </span>
                        <span className="block truncate font-mono text-xs text-white/80">
                          $ {command}
                        </span>
                      </span>
                      <ToolStatusIcon state={state} result={result} isActive={isActive} />
                    </div>
                    {output ? (
                      <pre className="max-h-24 overflow-hidden border-t border-white/10 px-3 py-2 font-mono text-[10px] leading-4 text-white/50">
                        {output.slice(0, 400)}
                      </pre>
                    ) : null}
                  </motion.button>
                );
              }

              return null;
            })}
          </div>
        </div>
      </motion.article>
    </AnimatePresence>
  );
};

function CopyTextButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Message copied" : "Copy message"}
      className={cn(
        "mt-0.5 flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[9px] font-medium text-zinc-500 opacity-70 transition-[opacity,color,background-color,border-color] hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-violet-400 sm:opacity-0 sm:group-hover/copy:opacity-100",
        copied &&
          "border-emerald-500/30 bg-emerald-950/60 text-emerald-300 opacity-100 sm:opacity-100",
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Memoizes completed messages while allowing the latest streaming message to update incrementally. */
export const PreviewMessage = memo(
  PurePreviewMessage,
  (previous, next) => {
    if (previous.message.annotations !== next.message.annotations) return false;
    if (!equal(previous.message.parts, next.message.parts)) return false;
    if (previous.isLatestMessage !== next.isLatestMessage) return false;
    if (
      (previous.isLatestMessage || next.isLatestMessage) &&
      previous.status !== next.status
    ) {
      return false;
    }
    if (previous.selectedEventId !== next.selectedEventId) {
      return !(
        messageContainsToolCall(previous.message, previous.selectedEventId) ||
        messageContainsToolCall(next.message, next.selectedEventId)
      );
    }
    return true;
  },
);
