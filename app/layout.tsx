/**
 * File: app/layout.tsx
 * Purpose: Configure the root document, metadata, fonts, analytics, global tooltips, and notifications.
 * Problem solved: Gives every route a consistent, discoverable application shell and document-level configuration.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ButtonTooltipProvider } from "@/components/button-tooltip-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "AI Agent Dashboard",
  description:
    "An observable computer-use agent dashboard powered by Anthropic and isolated desktop runtimes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <ButtonTooltipProvider />
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
