/**
 * File: components/settings/vnc-diagnostics-settings.tsx
 * Purpose: Explain and test the browser, Sandbox, VNC, and noVNC connection chain without exposing credentials.
 */
"use client";

import {
  Check,
  CircleAlert,
  CircleDashed,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  DiagnosticCheckStatus,
  VncClientDiagnostics,
  VncDiagnosticCheck,
  VncServerDiagnostics,
} from "@/lib/sandbox/diagnostics";
import { cn } from "@/lib/utils";

interface VncDiagnosticsSettingsProps {
  client: VncClientDiagnostics;
  reconnectDisabled: boolean;
  onRunDiagnostics: () => Promise<VncServerDiagnostics>;
  onReconnect: () => void;
}

const STATUS_COPY: Record<DiagnosticCheckStatus, string> = {
  pass: "Passed",
  fail: "Failed",
  skipped: "Not checked",
};

function StatusIcon({ status }: { status: DiagnosticCheckStatus }) {
  if (status === "pass") return <Check className="size-3.5" />;
  if (status === "fail") return <X className="size-3.5" />;
  return <CircleDashed className="size-3.5" />;
}

function DiagnosticRow({
  label,
  check,
}: {
  label: string;
  check: VncDiagnosticCheck;
}) {
  return (
    <div className="grid gap-1 border-b border-zinc-200 px-4 py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            check.status === "pass" && "bg-emerald-500/10 text-emerald-400",
            check.status === "fail" && "bg-red-500/10 text-red-400",
            check.status === "skipped" && "bg-zinc-100 text-zinc-500",
          )}
        >
          <StatusIcon status={check.status} />
        </span>
        <span className="text-[11px] font-medium text-zinc-900">{label}</span>
      </div>
      <div>
        <p
          className={cn(
            "text-[10px] font-medium",
            check.status === "pass" && "text-emerald-400",
            check.status === "fail" && "text-red-400",
            check.status === "skipped" && "text-zinc-500",
          )}
        >
          {STATUS_COPY[check.status]}
        </p>
        <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
          {check.detail}
        </p>
      </div>
    </div>
  );
}

export function VncDiagnosticsSettings({
  client,
  reconnectDisabled,
  onRunDiagnostics,
  onReconnect,
}: VncDiagnosticsSettingsProps) {
  const [report, setReport] = useState<VncServerDiagnostics | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const nextReport = await onRunDiagnostics();
      setReport(nextReport);
      if (nextReport.overall === "healthy" && client.viewerReady) {
        toast.success("VNC diagnostics passed");
      } else {
        toast.info("VNC diagnostics completed", {
          description:
            nextReport.overall === "healthy" && !client.viewerReady
              ? "The server-side RFB handshake passed, but this browser viewer is not connected yet."
              : nextReport.message,
        });
      }
    } catch {
      toast.error("VNC diagnostics could not run");
    } finally {
      setIsRunning(false);
    }
  };

  const copyDiagnostics = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ client, server: report }, null, 2),
      );
      toast.success("Diagnostics copied");
    } catch {
      toast.error("Could not copy diagnostics");
    }
  };

  const endToEndHealthy = report?.overall === "healthy" && client.viewerReady;
  const overallTone =
    endToEndHealthy
      ? "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-400"
      : report?.overall === "degraded"
        ? "border-red-500/25 bg-red-500/[0.05] text-red-400"
        : "border-zinc-200 bg-zinc-50 text-zinc-500";

  return (
    <section
      aria-labelledby="vnc-diagnostics-title"
      className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-7"
    >
      <div className="mb-5">
        <h3 id="vnc-diagnostics-title" className="text-sm font-semibold">
          VNC Diagnostics
        </h3>
        <p className="mt-1 text-[10px] leading-4 text-zinc-500">
          Test the server-side Sandbox and noVNC chain without exposing Vercel
          credentials or snapshot values to the browser.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Active desktop
          </p>
          <p className="mt-2 text-xs font-semibold text-zinc-900">
            {client.desktopTitle ?? "No desktop selected"}
          </p>
          <p className="mt-1 break-all font-mono text-[9px] leading-4 text-zinc-500">
            {client.sandboxId ?? "Sandbox not allocated"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Browser state
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-zinc-200 px-2 py-1 text-[9px] font-medium text-zinc-700">
              {client.connectionStatus.replaceAll("_", " ")}
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-1 text-[9px] font-medium text-zinc-700">
              {client.streamAttached ? "stream attached" : "no stream"}
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-1 text-[9px] font-medium text-zinc-700">
              {client.viewerReady ? "viewer ready" : "viewer pending"}
            </span>
          </div>
        </div>
      </div>

      <div className={cn("mt-4 rounded-xl border p-4", overallTone)}>
        <div className="flex items-start gap-3">
          {endToEndHealthy ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <div>
            <p className="text-[11px] font-semibold">
              {report
                ? endToEndHealthy
                  ? "VNC chain is healthy"
                  : report.overall === "healthy"
                    ? "Server is healthy; viewer is pending"
                  : report.overall === "not_ready"
                    ? "Desktop is not allocated"
                    : "VNC chain needs attention"
                : "Run a server-side diagnostic"}
            </p>
            <p className="mt-1 text-[10px] leading-4 opacity-80">
              {report?.message ??
                "Checks Vercel authentication, the snapshot, ports 5900 and 6080, and an external WebSocket/RFB handshake."}
            </p>
          </div>
        </div>
      </div>

      {report ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/40">
          <DiagnosticRow
            label="Vercel authentication"
            check={report.deployment.authentication}
          />
          <DiagnosticRow label="Sandbox snapshot" check={report.deployment.snapshot} />
          <DiagnosticRow label="Sandbox control plane" check={report.sandbox.controlPlane} />
          <DiagnosticRow label="VNC · 5900" check={report.services.vnc} />
          <DiagnosticRow label="noVNC · 6080" check={report.services.noVnc} />
          <DiagnosticRow
            label="External WebSocket · RFB"
            check={report.services.streamRoute}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] text-zinc-500">
          {report
            ? `Last checked ${new Date(report.checkedAt).toLocaleString()}`
            : "No diagnostic has been run in this Settings session."}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {report ? (
            <button
              type="button"
              onClick={() => void copyDiagnostics()}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Clipboard className="size-3.5" />
              Copy report
            </button>
          ) : null}
          <button
            type="button"
            disabled={!client.desktopTitle || reconnectDisabled}
            onClick={() => {
              setReport(null);
              onReconnect();
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="size-3.5" />
            Reconnect
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => void runDiagnostics()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[10px] font-semibold text-primary-foreground hover:opacity-85 focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-60"
          >
            {isRunning ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            {isRunning ? "Checking…" : "Run diagnostics"}
          </button>
        </div>
      </div>
    </section>
  );
}
