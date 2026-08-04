/**
 * File: components/dashboard/onboarding-tutorial.tsx
 * Purpose: Guide first-time users through the dashboard with a responsive spotlight overlay.
 * Problem solved: Introduces the main workspace surfaces without blocking repeat visitors or hiding replay controls.
 */
"use client";

import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  MessageSquareText,
  Monitor,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export const TUTORIAL_STORAGE_KEY = "agent-desk-tutorial-v1-complete";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  target?: string;
}

interface HighlightBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const sharedSteps: Record<string, TutorialStep> = {
  welcome: {
    id: "welcome",
    title: "Welcome to Agent Desk",
    description:
      "A quick tour will show you where to organize work, talk to the agent, and watch every action unfold.",
    icon: <Sparkles className="size-4" />,
  },
  desktops: {
    id: "desktops",
    title: "Keep work separated",
    description:
      "Each desktop has its own remote computer and conversations. Create, switch, pin, rename, or reorder them here.",
    icon: <Monitor className="size-4" />,
    target: '[data-tutorial="desktop-nav"]',
  },
  chat: {
    id: "chat",
    title: "Direct the agent",
    description:
      "Start conversations, send tasks, and queue follow-ups while the current run is still in progress.",
    icon: <MessageSquareText className="size-4" />,
    target: '[data-tutorial="chat-workspace"]',
  },
  desktop: {
    id: "desktop",
    title: "Watch the live desktop",
    description:
      "The remote computer stays visible while the agent works, so navigation, clicks, and typing remain observable.",
    icon: <Monitor className="size-4" />,
    target: '[data-tutorial="desktop-viewer"]',
  },
  inspector: {
    id: "inspector",
    title: "Inspect every action",
    description:
      "Select an event to review screenshots, commands, outputs, timing, and the exact target used by the agent.",
    icon: <Crosshair className="size-4" />,
    target: '[data-tutorial="inspector"]',
  },
  settings: {
    id: "settings",
    title: "Make the workspace yours",
    description:
      "Configure model access, choose a theme, or return to this tutorial at any time from Settings.",
    icon: <Settings className="size-4" />,
    target: '[data-tutorial="settings"]',
  },
};

const desktopSteps = [
  sharedSteps.welcome,
  sharedSteps.desktops,
  sharedSteps.chat,
  sharedSteps.desktop,
  sharedSteps.inspector,
  sharedSteps.settings,
];

const mobileSteps = [
  sharedSteps.welcome,
  sharedSteps.desktops,
  sharedSteps.desktop,
  sharedSteps.chat,
  sharedSteps.settings,
];

function visibleTarget(selector: string | undefined) {
  if (!selector) return null;
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) =>
        element.getClientRects().length > 0 &&
        element.getBoundingClientRect().width > 0 &&
        element.getBoundingClientRect().height > 0,
    ) ?? null
  );
}

function cardPosition(
  highlight: HighlightBounds | null,
  card: { width: number; height: number },
) {
  if (!highlight) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    } satisfies CSSProperties;
  }

  const margin = 16;
  const gap = 18;
  const width = card.width || Math.min(360, window.innerWidth - margin * 2);
  const height = card.height || 250;
  const clampLeft = (value: number) =>
    Math.max(margin, Math.min(value, window.innerWidth - width - margin));
  const clampTop = (value: number) =>
    Math.max(margin, Math.min(value, window.innerHeight - height - margin));

  if (window.innerWidth < 640) {
    return {
      left: margin,
      top:
        highlight.top + highlight.height / 2 > window.innerHeight / 2
          ? margin
          : Math.max(margin, window.innerHeight - height - margin),
    } satisfies CSSProperties;
  }

  if (highlight.left + highlight.width + gap + width <= window.innerWidth) {
    return {
      left: highlight.left + highlight.width + gap,
      top: clampTop(highlight.top + highlight.height / 2 - height / 2),
    } satisfies CSSProperties;
  }
  if (highlight.left - gap - width >= 0) {
    return {
      left: highlight.left - gap - width,
      top: clampTop(highlight.top + highlight.height / 2 - height / 2),
    } satisfies CSSProperties;
  }
  if (highlight.top + highlight.height + gap + height <= window.innerHeight) {
    return {
      left: clampLeft(highlight.left + highlight.width / 2 - width / 2),
      top: highlight.top + highlight.height + gap,
    } satisfies CSSProperties;
  }
  return {
    left: clampLeft(highlight.left + highlight.width / 2 - width / 2),
    top: clampTop(highlight.top - gap - height),
  } satisfies CSSProperties;
}

export function OnboardingTutorial({
  open,
  onComplete,
  onSkip,
}: {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);
  const [highlight, setHighlight] = useState<HighlightBounds | null>(null);
  const [cardSize, setCardSize] = useState({ width: 360, height: 250 });
  const cardRef = useRef<HTMLDivElement>(null);
  const steps = useMemo(
    () => (isDesktop ? desktopSteps : mobileSteps),
    [isDesktop],
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const updateHighlight = useCallback(() => {
    const target = visibleTarget(step.target);
    if (!target) {
      setHighlight(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const padding = window.innerWidth < 640 ? 5 : 8;
    setHighlight({
      left: Math.max(6, rect.left - padding),
      top: Math.max(6, rect.top - padding),
      width: Math.min(
        window.innerWidth - Math.max(6, rect.left - padding) - 6,
        rect.width + padding * 2,
      ),
      height: Math.min(
        window.innerHeight - Math.max(6, rect.top - padding) - 6,
        rect.height + padding * 2,
      ),
    });
  }, [step.target]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    const query = window.matchMedia("(min-width: 768px)");
    const updateLayout = () => setIsDesktop(query.matches);
    updateLayout();
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updateHighlight);
    const target = visibleTarget(step.target);
    const observer = target ? new ResizeObserver(updateHighlight) : null;
    if (target) observer?.observe(target);
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [open, step.target, updateHighlight]);

  useEffect(() => {
    if (!open || !cardRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setCardSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => cardRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onSkip, open]);

  if (!open || typeof document === "undefined") return null;

  const lastStep = stepIndex === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[150] overflow-hidden" data-tutorial-overlay>
      {highlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl border-2 border-violet-300 bg-white/[0.03] shadow-[0_0_0_9999px_rgba(0,0,0,0.72),0_0_0_5px_rgba(139,92,246,0.18),0_18px_60px_rgba(0,0,0,0.28)] transition-all duration-300 motion-reduce:transition-none"
          style={highlight}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-description"
        tabIndex={-1}
        style={cardPosition(highlight, cardSize)}
        className="absolute w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/15 bg-[#111113]/95 text-white shadow-2xl outline-none backdrop-blur-xl transition-[left,top] duration-300 motion-reduce:transition-none"
      >
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/15">
                {step.icon}
              </span>
              Step {stepIndex + 1} of {steps.length}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400"
              aria-label="Skip tutorial"
            >
              <X className="size-4" />
            </button>
          </div>

          <h2 id="tutorial-title" className="mt-4 text-lg font-semibold">
            {step.title}
          </h2>
          <p
            id="tutorial-description"
            className="mt-2 text-xs leading-5 text-zinc-400"
          >
            {step.description}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                    index === stepIndex
                      ? "w-5 bg-violet-400"
                      : index < stepIndex
                        ? "w-1.5 bg-violet-400/50"
                        : "w-1.5 bg-white/15",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => current - 1)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSkip}
                  className="h-9 rounded-lg px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (lastStep) {
                    onComplete();
                  } else {
                    setStepIndex((current) => current + 1);
                  }
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-black transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {lastStep ? "Finish" : "Next"}
                {!lastStep ? <ArrowRight className="size-3.5" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
