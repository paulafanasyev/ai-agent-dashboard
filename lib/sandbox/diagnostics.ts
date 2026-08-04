/**
 * File: lib/sandbox/diagnostics.ts
 * Purpose: Define the serializable, non-sensitive VNC diagnostics contract.
 */
import type { ConnectionStatus } from "@/lib/dashboard/types";

export type DiagnosticCheckStatus = "pass" | "fail" | "skipped";
export type DiagnosticOverallStatus = "healthy" | "degraded" | "not_ready";

export interface VncDiagnosticCheck {
  status: DiagnosticCheckStatus;
  detail: string;
}

export interface VncServerDiagnostics {
  checkedAt: string;
  overall: DiagnosticOverallStatus;
  deployment: {
    platform: "vercel" | "external";
    authentication: VncDiagnosticCheck;
    snapshot: VncDiagnosticCheck;
  };
  sandbox: {
    id: string | null;
    controlPlane: VncDiagnosticCheck;
    status: string | null;
  };
  services: {
    vnc: VncDiagnosticCheck;
    noVnc: VncDiagnosticCheck;
    streamRoute: VncDiagnosticCheck;
  };
  message: string;
}

export interface VncClientDiagnostics {
  desktopTitle: string | null;
  sandboxId: string | null;
  connectionStatus: ConnectionStatus | "no_desktop";
  streamAttached: boolean;
  viewerReady: boolean;
}
