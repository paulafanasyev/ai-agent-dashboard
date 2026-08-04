/**
 * File: components/theme-provider.tsx
 * Purpose: Apply and persist the dashboard's named visual themes.
 * Problem solved: Centralizes theme identity so every dashboard surface responds to one device-local preference.
 */
"use client";

import {
  ThemeProvider as NextThemeProvider,
  useTheme,
} from "next-themes";
import { useEffect, type ReactNode } from "react";

export const DASHBOARD_THEMES = [
  "vercel",
  "vue",
  "xcode",
  "github",
] as const;

export type DashboardTheme = (typeof DASHBOARD_THEMES)[number];

export const THEME_STORAGE_KEY = "agent-desk-theme";

function DashboardThemeGuard({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (
      theme &&
      !DASHBOARD_THEMES.includes(theme as DashboardTheme)
    ) {
      setTheme("vercel");
    }
  }, [setTheme, theme]);

  return children;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="vercel"
      enableSystem={false}
      themes={[...DASHBOARD_THEMES]}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <DashboardThemeGuard>{children}</DashboardThemeGuard>
    </NextThemeProvider>
  );
}
