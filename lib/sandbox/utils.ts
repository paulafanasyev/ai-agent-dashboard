/**
 * File: lib/sandbox/utils.ts
 * Purpose: Reliably create, reconnect, expose, and stop Vercel Sandbox desktop instances.
 * Problem solved: Manages the noVNC lifecycle while tolerating brief control-plane network interruptions.
 */
"use server";

import { Sandbox } from "@vercel/sandbox";
import type {
  DiagnosticCheckStatus,
  VncServerDiagnostics,
} from "@/lib/sandbox/diagnostics";
import { probeExternalRfb } from "@/lib/sandbox/rfb-probe";
import { DESKTOP_STARTUP_SCRIPT } from "@/lib/sandbox/snapshot-runtime";
import { resolution } from "./config";

const NOVNC_PORT = 6080;
const VNC_PORT = 5900;
const DISPLAY_ENV = { DISPLAY: ":99" };
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1_000;
const SANDBOX_LOOKUP_RETRY_DELAYS = [0, 450, 1200] as const;
const EXTERNAL_RFB_RETRY_DELAYS = [0, 750, 1_500, 3_000] as const;
const NOVNC_STATUS_BRIDGE = `(() => {
  const source = "agent-dashboard-vnc";
  const report = () => {
    const root = document.documentElement;
    const state = root.classList.contains("noVNC_connected")
      ? "ready"
      : root.classList.contains("noVNC_reconnecting")
        ? "reconnecting"
      : root.classList.contains("noVNC_disconnected")
        ? "offline"
        : "connecting";
    window.parent.postMessage({ source, state }, "*");
  };
  new MutationObserver(report).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("load", report);
  report();
})();`;

/** Retries transient Vercel control-plane lookup failures without allocating a duplicate runtime. */
async function getSandboxWithRetry(sandboxId: string) {
  let lastError: unknown;
  for (const delayMs of SANDBOX_LOOKUP_RETRY_DELAYS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      return await Sandbox.get({ sandboxId });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Injects a tiny noVNC bridge that reports viewer state to the parent Dashboard via postMessage. */
async function installNoVNCStatusBridge(sandbox: Sandbox) {
  const encodedBridge = Buffer.from(NOVNC_STATUS_BRIDGE).toString("base64");
  const script = `
import base64
import sys
from pathlib import Path

html_path = Path("/usr/share/novnc/vnc.html")
bridge_path = Path("/usr/share/novnc/app/dashboard-status-bridge.js")
marker = '<script src="app/dashboard-status-bridge.js"></script>'
bridge_path.write_bytes(base64.b64decode(sys.argv[1]))
html = html_path.read_text()
if marker not in html:
    html_path.write_text(html.replace("</body>", f"  {marker}\\n</body>"))
`;
  const result = await sandbox.runCommand({
    cmd: "python3",
    args: ["-c", script, encodedBridge],
    sudo: true,
  });
  if (result.exitCode !== 0) {
    throw new Error("Failed to install the noVNC status bridge");
  }
}

/** Refreshes the supervised startup script so older snapshots receive current runtime fixes. */
async function installDesktopStartupScript(sandbox: Sandbox) {
  await sandbox.writeFiles([
    {
      path: "start-desktop.sh",
      content: Buffer.from(DESKTOP_STARTUP_SCRIPT),
    },
  ]);
  const result = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      "mv /vercel/sandbox/start-desktop.sh /usr/local/bin/start-desktop.sh && chmod +x /usr/local/bin/start-desktop.sh",
    ],
    sudo: true,
  });
  if (result.exitCode !== 0) {
    throw new Error("Failed to install the supervised desktop startup script");
  }
}

/**
 * Reuses a healthy running Sandbox when possible; otherwise creates and boots one from the snapshot.
 * A failed existing runtime is stopped before replacement to avoid returning a stale VNC route.
 */
export const getDesktop = async (id?: string) => {
  try {
    if (id) {
      const sandbox = await getSandboxWithRetry(id);
      if (sandbox.status === "running") {
        try {
          await installNoVNCStatusBridge(sandbox);
          await waitForNoVNC(sandbox, 4);
          return sandbox;
        } catch {
          await sandbox.stop();
        }
      }
    }

    const sandbox = await Sandbox.create({
      source: {
        type: "snapshot",
        snapshotId: process.env.SANDBOX_SNAPSHOT_ID!,
      },
      timeout: SANDBOX_TIMEOUT_MS,
      ports: [NOVNC_PORT],
    });

    await installNoVNCStatusBridge(sandbox);
    await installDesktopStartupScript(sandbox);

    // Start the desktop environment
    await sandbox.runCommand({
      cmd: "bash",
      args: ["/usr/local/bin/start-desktop.sh"],
      env: {
        RESOLUTION: `${resolution.x}x${resolution.y}`,
      },
      detached: true,
    });

    // Wait for noVNC to be ready
    await waitForNoVNC(sandbox);

    // Set background color (ctypes.util is missing on AL2023, load libX11 directly)
    await sandbox.runCommand({
      cmd: "python3",
      args: [
        "-c",
        `import ctypes
lib = ctypes.cdll.LoadLibrary('libX11.so.6')
d = lib.XOpenDisplay(None)
s = lib.XDefaultScreen(d)
r = lib.XRootWindow(d, s)
lib.XSetWindowBackground(d, r, 0x2D2D2D)
lib.XClearWindow(d, r)
lib.XFlush(d)
lib.XCloseDisplay(d)`,
      ],
      env: DISPLAY_ENV,
    });

    return sandbox;
  } catch (error) {
    console.error("Error in getDesktop:", error);
    throw error;
  }
};

/** Waits until both local Xvnc and noVNC HTTP probes pass inside the Sandbox. */
async function waitForNoVNC(sandbox: Sandbox, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    if (await areDesktopServicesHealthy(sandbox)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("noVNC health check timed out");
}

/** Probes Xvnc port 5900 and noVNC HTTP port 6080 from inside the runtime. */
async function areDesktopServicesHealthy(sandbox: Sandbox) {
  try {
    const result = await sandbox.runCommand({
      cmd: "python3",
      args: [
        "-c",
        `import socket
import urllib.request

connection = socket.create_connection(("127.0.0.1", ${VNC_PORT}), timeout=2)
connection.close()
with urllib.request.urlopen("http://127.0.0.1:${NOVNC_PORT}", timeout=2) as response:
    print(response.status)`,
      ],
    });
    return result.exitCode === 0 && (await result.stdout()).trim() === "200";
  } catch {
    return false;
  }
}

/** Retries the external WebSocket/RFB handshake because public port routing may lag local startup. */
async function waitForExternalRfb(baseUrl: string) {
  let lastDetail = "The external WebSocket route is not ready.";
  for (const delayMs of EXTERNAL_RFB_RETRY_DELAYS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const probe = await probeExternalRfb(baseUrl);
    if (probe.healthy) return probe;
    lastDetail = probe.detail;
  }
  throw new Error(lastDetail);
}

function diagnosticCheck(
  status: DiagnosticCheckStatus,
  detail: string,
) {
  return { status, detail } as const;
}

function hasSandboxAuthentication() {
  if (process.env.VERCEL === "1") {
    return diagnosticCheck(
      "pass",
      "Automatic Vercel OIDC is available in this deployment.",
    );
  }
  if (process.env.VERCEL_OIDC_TOKEN) {
    return diagnosticCheck("pass", "A Vercel OIDC token is configured.");
  }
  if (
    process.env.VERCEL_TOKEN &&
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID
  ) {
    return diagnosticCheck(
      "pass",
      "Vercel access-token credentials are configured server-side.",
    );
  }
  return diagnosticCheck(
    "fail",
    "No server-side Vercel Sandbox authentication was detected.",
  );
}

function skippedServices(detail: string) {
  return {
    vnc: diagnosticCheck("skipped", detail),
    noVnc: diagnosticCheck("skipped", detail),
    streamRoute: diagnosticCheck("skipped", detail),
  };
}

interface ServiceProbe {
  vnc: boolean;
  noVnc: boolean;
}

function parseServiceProbe(value: string): ServiceProbe | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "vnc" in parsed &&
      typeof parsed.vnc === "boolean" &&
      "noVnc" in parsed &&
      typeof parsed.noVnc === "boolean"
    ) {
      return { vnc: parsed.vnc, noVnc: parsed.noVnc };
    }
  } catch {
    return null;
  }
  return null;
}

/** Returns a serializable, credential-free breakdown of every Desktop connection layer. */
export const diagnoseDesktop = async (
  sandboxId?: string,
): Promise<VncServerDiagnostics> => {
  const checkedAt = new Date().toISOString();
  const platform = process.env.VERCEL === "1" ? "vercel" : "external";
  const authentication = hasSandboxAuthentication();
  const snapshot = process.env.SANDBOX_SNAPSHOT_ID
    ? diagnosticCheck("pass", "A Sandbox snapshot is configured server-side.")
    : diagnosticCheck("fail", "SANDBOX_SNAPSHOT_ID is missing.");

  if (!sandboxId) {
    return {
      checkedAt,
      overall: "not_ready",
      deployment: { platform, authentication, snapshot },
      sandbox: {
        id: null,
        controlPlane: diagnosticCheck(
          "skipped",
          "Create or connect a desktop before probing the Sandbox.",
        ),
        status: null,
      },
      services: skippedServices("No Sandbox is allocated yet."),
      message: "Desktop not allocated. Infrastructure configuration was checked.",
    };
  }

  try {
    const sandbox = await getSandboxWithRetry(sandboxId);
    const sandboxRunning = sandbox.status === "running";
    if (!sandboxRunning) {
      return {
        checkedAt,
        overall: "degraded",
        deployment: { platform, authentication, snapshot },
        sandbox: {
          id: sandboxId,
          controlPlane: diagnosticCheck(
            "pass",
            "The Sandbox control plane returned this desktop.",
          ),
          status: String(sandbox.status),
        },
        services: skippedServices(
          `Sandbox status is ${String(sandbox.status)} instead of running.`,
        ),
        message: "Sandbox exists but is not currently running.",
      };
    }

    const probeScript = `import json
import socket
import urllib.request

result = {"vnc": False, "noVnc": False}
try:
    connection = socket.create_connection(("127.0.0.1", ${VNC_PORT}), timeout=2)
    connection.close()
    result["vnc"] = True
except Exception:
    pass

try:
    with urllib.request.urlopen("http://127.0.0.1:${NOVNC_PORT}", timeout=2) as response:
        result["noVnc"] = response.status == 200
except Exception:
    pass

print(json.dumps(result))`;
    const result = await sandbox.runCommand({
      cmd: "python3",
      args: ["-c", probeScript],
    });
    const probe =
      result.exitCode === 0
        ? parseServiceProbe((await result.stdout()).trim())
        : null;
    const streamUrl = sandbox.domain(NOVNC_PORT);
    const externalRfb = await probeExternalRfb(streamUrl);
    const streamRouteAvailable = externalRfb.healthy;
    const vncHealthy = probe?.vnc === true;
    const noVncHealthy = probe?.noVnc === true;
    const healthy =
      authentication.status === "pass" &&
      snapshot.status === "pass" &&
      vncHealthy &&
      noVncHealthy &&
      streamRouteAvailable;

    return {
      checkedAt,
      overall: healthy ? "healthy" : "degraded",
      deployment: { platform, authentication, snapshot },
      sandbox: {
        id: sandboxId,
        controlPlane: diagnosticCheck(
          "pass",
          "The Sandbox is reachable through the Vercel control plane.",
        ),
        status: String(sandbox.status),
      },
      services: {
        vnc: diagnosticCheck(
          vncHealthy ? "pass" : "fail",
          vncHealthy
            ? `Xvnc is accepting connections on port ${VNC_PORT}.`
            : `Nothing responded on VNC port ${VNC_PORT}.`,
        ),
        noVnc: diagnosticCheck(
          noVncHealthy ? "pass" : "fail",
          noVncHealthy
            ? `noVNC returned HTTP 200 on port ${NOVNC_PORT}.`
            : `noVNC did not return HTTP 200 on port ${NOVNC_PORT}.`,
        ),
        streamRoute: diagnosticCheck(
          streamRouteAvailable ? "pass" : "fail",
          externalRfb.detail,
        ),
      },
      message: healthy
        ? "Sandbox, VNC, noVNC, and the external stream route are healthy."
        : "One or more VNC checks failed. Review the details before reconnecting.",
    };
  } catch (error) {
    return {
      checkedAt,
      overall: "degraded",
      deployment: { platform, authentication, snapshot },
      sandbox: {
        id: sandboxId,
        controlPlane: diagnosticCheck(
          "fail",
          error instanceof Error
            ? error.message.slice(0, 300)
            : "The Sandbox control plane request failed.",
        ),
        status: null,
      },
      services: skippedServices(
        "Service checks require a reachable Sandbox.",
      ),
      message: "The Sandbox could not be resolved from this deployment.",
    };
  }
};

/** Requires a running Sandbox, healthy local services, and a working external RFB handshake. */
export const checkDesktopHealth = async (id: string) => {
  try {
    const sandbox = await getSandboxWithRetry(id);
    if (
      sandbox.status !== "running" ||
      !(await areDesktopServicesHealthy(sandbox))
    ) {
      return false;
    }
    return (await probeExternalRfb(sandbox.domain(NOVNC_PORT))).healthy;
  } catch {
    return false;
  }
};

/** Resolves a Desktop only when all health layers pass; tool calls use this as their final guard. */
export const getReadyDesktop = async (id: string | undefined) => {
  if (!id) throw new Error("A desktop is required before running tools");
  const sandbox = await getSandboxWithRetry(id);
  if (
    sandbox.status !== "running" ||
    !(await areDesktopServicesHealthy(sandbox))
  ) {
    throw new Error("The desktop is not ready for tool execution");
  }
  return sandbox;
};

/** Allocates or reconnects a Desktop and returns only its browser-safe ID and noVNC URL. */
export const getDesktopURL = async (id?: string) => {
  try {
    const sandbox = await getDesktop(id);
    const baseUrl = sandbox.domain(NOVNC_PORT);
    await waitForExternalRfb(baseUrl);
    const streamUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`;

    return { streamUrl, id: sandbox.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

/** Stops one explicitly identified Sandbox and releases its remote compute. */
export const killDesktop = async (id: string) => {
  try {
    const sandbox = await getSandboxWithRetry(id);
    await sandbox.stop();
  } catch (error) {
    console.error("Error killing desktop:", error);
  }
};
