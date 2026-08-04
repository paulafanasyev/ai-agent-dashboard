/**
 * File: lib/sandbox/rfb-probe.ts
 * Purpose: Verify that a public Sandbox route can complete a WebSocket/RFB handshake.
 * Problem solved: Distinguishes a working noVNC page from a stream route that serves HTTP but cannot reach Xvnc.
 */

import WebSocket, { type RawData } from "ws";

const RFB_BANNER = /^RFB \d{3}\.\d{3}\n/;
const RFB_3_3_VERSION = Buffer.from("RFB 003.003\n", "ascii");
const RFB_VERSION_LENGTH = 12;
const RFB_SECURITY_TYPE_NONE = 1;
const RFB_SERVER_INIT_FIXED_LENGTH = 24;
const MAX_DESKTOP_NAME_LENGTH = 64 * 1024;

export interface RfbProbeResult {
  healthy: boolean;
  detail: string;
}

/** Maps an exposed noVNC page URL to the public websockify WebSocket endpoint. */
export function externalRfbWebSocketUrl(baseUrl: string) {
  const url = new URL("/websockify", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function rawDataBuffer(data: RawData) {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data);
}

/** Accepts only an RFB version banner, proving the route reached a VNC backend rather than HTTP. */
export function isRfbProtocolBanner(value: string) {
  return RFB_BANNER.test(value);
}

/**
 * Opens a real external WebSocket and completes an anonymous RFB 3.3 handshake.
 * Reading only the server banner and disconnecting is intentionally insufficient: Xvnc counts
 * that as a failed authentication attempt and can blacklist websockify's shared loopback address.
 */
export async function probeExternalRfb(
  baseUrl: string,
  timeoutMs = 5_000,
): Promise<RfbProbeResult> {
  const websocketUrl = externalRfbWebSocketUrl(baseUrl);

  return new Promise((resolve) => {
    let settled = false;
    let received = Buffer.alloc(0);
    let phase: "version" | "security" | "server-init" = "version";
    const socket = new WebSocket(websocketUrl, ["binary"]);
    const finish = (result: RfbProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.removeAllListeners();
      if (socket.readyState === WebSocket.OPEN) socket.close(1000);
      else if (socket.readyState === WebSocket.CONNECTING) {
        // ws emits an asynchronous error when a pending connection is terminated. Keep a
        // no-op listener until that expected cleanup event arrives so it cannot escape as an
        // uncaught server exception after the probe has already resolved.
        socket.once("error", () => {});
        socket.terminate();
      }
      resolve(result);
    };
    const timeout = setTimeout(
      () =>
        finish({
          healthy: false,
          detail:
            phase === "version"
              ? "The external WebSocket did not return an RFB banner in time."
              : "The external WebSocket did not complete the RFB handshake in time.",
        }),
      timeoutMs,
    );

    socket.on("message", (data) => {
      if (settled) return;
      received = Buffer.concat([received, rawDataBuffer(data)]);

      while (!settled) {
        if (phase === "version") {
          if (received.length < RFB_VERSION_LENGTH) return;
          const banner = received.subarray(0, RFB_VERSION_LENGTH).toString("ascii");
          received = received.subarray(RFB_VERSION_LENGTH);
          if (!isRfbProtocolBanner(banner)) {
            finish({
              healthy: false,
              detail: "The external WebSocket returned an invalid RFB banner.",
            });
            return;
          }

          // RFB explicitly permits negotiating an older version. Version 3.3 has a compact,
          // deterministic None-security flow that is supported by the passwordless Xvnc runtime.
          socket.send(RFB_3_3_VERSION);
          phase = "security";
          continue;
        }

        if (phase === "security") {
          if (received.length < 4) return;
          const securityType = received.readUInt32BE(0);
          received = received.subarray(4);
          if (securityType !== RFB_SECURITY_TYPE_NONE) {
            finish({
              healthy: false,
              detail:
                securityType === 0
                  ? "The RFB server rejected the probe during security negotiation."
                  : `The RFB server requires unsupported security type ${securityType}.`,
            });
            return;
          }

          // A non-zero shared flag completes ClientInit without evicting the real noVNC viewer.
          socket.send(Buffer.from([1]));
          phase = "server-init";
          continue;
        }

        if (received.length < RFB_SERVER_INIT_FIXED_LENGTH) return;
        const desktopNameLength = received.readUInt32BE(20);
        if (desktopNameLength > MAX_DESKTOP_NAME_LENGTH) {
          finish({
            healthy: false,
            detail: "The RFB server returned an invalid desktop name length.",
          });
          return;
        }
        if (
          received.length <
          RFB_SERVER_INIT_FIXED_LENGTH + desktopNameLength
        ) {
          return;
        }
        finish({
          healthy: true,
          detail: "The external WebSocket completed an RFB handshake.",
        });
        return;
      }
    });
    socket.once("error", () =>
      finish({
        healthy: false,
        detail: "The external WebSocket route could not be opened.",
      }),
    );
    socket.once("close", () =>
      finish({
        healthy: false,
        detail: "The external WebSocket closed before the RFB handshake.",
      }),
    );
  });
}
