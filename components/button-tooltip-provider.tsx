/**
 * File: components/button-tooltip-provider.tsx
 * Purpose: Explain every button through one consistent hover and focus tooltip.
 * Problem solved: Makes icon-only, compact, disabled, and newly added controls discoverable without duplicating tooltip state across components.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipState {
  text: string;
  left: number;
  top: number;
  placement: "top" | "bottom";
}

const TOOLTIP_DELAY_MS = 420;
const TOOLTIP_MAX_LENGTH = 96;

function tooltipText(button: HTMLButtonElement) {
  const explicitText =
    button.dataset.tooltip ??
    button.getAttribute("aria-label") ??
    button.dataset.buttonTooltipTitle;
  const visibleText = button.innerText.replace(/\s+/g, " ").trim();
  const text = (explicitText ?? visibleText).trim();
  if (!text) return "Button";
  return text.length > TOOLTIP_MAX_LENGTH
    ? `${text.slice(0, TOOLTIP_MAX_LENGTH - 1)}…`
    : text;
}

function tooltipPosition(button: HTMLButtonElement): Omit<TooltipState, "text"> {
  const bounds = button.getBoundingClientRect();
  const halfViewport = window.innerWidth / 2;
  const horizontalGuard = Math.max(12, Math.min(126, halfViewport - 8));
  const placement = bounds.top >= 52 ? "top" : "bottom";
  return {
    left: Math.max(
      horizontalGuard,
      Math.min(bounds.left + bounds.width / 2, window.innerWidth - horizontalGuard),
    ),
    top: placement === "top" ? bounds.top - 8 : bounds.bottom + 8,
    placement,
  };
}

function closestButton(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>("button")
    : null;
}

export function ButtonTooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (showTimerRef.current === null) return;
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    };

    const hide = () => {
      clearTimer();
      activeButtonRef.current = null;
      setTooltip(null);
    };

    const show = (button: HTMLButtonElement, delay: number) => {
      if (activeButtonRef.current === button) return;
      clearTimer();
      activeButtonRef.current = button;
      showTimerRef.current = window.setTimeout(() => {
        if (!button.isConnected || activeButtonRef.current !== button) return;
        setTooltip({ text: tooltipText(button), ...tooltipPosition(button) });
        showTimerRef.current = null;
      }, delay);
    };

    const prepareTitles = (root: ParentNode) => {
      root.querySelectorAll<HTMLButtonElement>("button[title]").forEach((button) => {
        const title = button.getAttribute("title");
        if (!title) return;
        button.dataset.buttonTooltipTitle = title;
        button.removeAttribute("title");
      });
    };

    prepareTitles(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          prepareTitles(mutation.target.parentNode ?? mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches("button[title]")) prepareTitles(node.parentNode ?? node);
            prepareTitles(node);
          }
        });
      });
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["title"],
      childList: true,
      subtree: true,
    });

    const onPointerOver = (event: PointerEvent) => {
      const button = closestButton(event.target);
      if (button) show(button, TOOLTIP_DELAY_MS);
    };
    const onPointerOut = (event: PointerEvent) => {
      const button = closestButton(event.target);
      if (!button) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && button.contains(nextTarget)) return;
      hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const button = closestButton(event.target);
      if (button) show(button, 180);
    };
    const onFocusOut = (event: FocusEvent) => {
      const button = closestButton(event.target);
      if (!button) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && button.contains(nextTarget)) return;
      hide();
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("click", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      clearTimer();
      observer.disconnect();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("click", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
      className={cn(
        "pointer-events-none fixed z-[250] max-w-60 -translate-x-1/2 animate-in rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center text-[10px] font-medium leading-4 text-zinc-700 shadow-xl fade-in zoom-in-95 duration-100",
        tooltip.placement === "top" ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {tooltip.text}
    </div>
  );
}
