/**
 * File: lib/dashboard/use-dashboard-tutorial.ts
 * Purpose: Own first-open tutorial persistence and replay controls.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { TUTORIAL_STORAGE_KEY } from "@/components/dashboard/onboarding-tutorial";

export function useDashboardTutorial(isHydrated: boolean) {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === "complete") return;
    const frame = window.requestAnimationFrame(() => setIsTutorialOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isHydrated]);

  const closeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "complete");
    setIsTutorialOpen(false);
  }, []);

  const replayTutorial = useCallback(() => setIsTutorialOpen(true), []);

  return { isTutorialOpen, closeTutorial, replayTutorial };
}
