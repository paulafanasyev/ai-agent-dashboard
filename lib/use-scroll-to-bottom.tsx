/**
 * File: lib/use-scroll-to-bottom.tsx
 * Purpose: Keep a streaming conversation anchored to its newest content.
 * Problem solved: Maintains chat readability as messages and tool results arrive incrementally.
 */
import { useEffect, useRef, type RefObject } from "react";

const BOTTOM_THRESHOLD_PX = 120;

export function useScrollToBottom(): [
  RefObject<HTMLDivElement | null>,
  RefObject<HTMLDivElement | null>,
] {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame: number | null = null;
    let shouldStickToBottom = true;

    const updateStickiness = () => {
      shouldStickToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        BOTTOM_THRESHOLD_PX;
    };
    const scheduleScroll = () => {
      if (!shouldStickToBottom || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        container.scrollTop = container.scrollHeight;
      });
    };
    const observer = new MutationObserver(scheduleScroll);

    container.addEventListener("scroll", updateStickiness, { passive: true });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleScroll();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("scroll", updateStickiness);
    };
  }, []);

  return [containerRef, endRef];
}
