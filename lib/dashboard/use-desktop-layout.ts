/**
 * File: lib/dashboard/use-desktop-layout.ts
 * Purpose: Project the responsive desktop breakpoint into React state.
 */
"use client";

import { useEffect, useState } from "react";

export function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
