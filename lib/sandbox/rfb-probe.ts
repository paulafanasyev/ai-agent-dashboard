/**
 * File: lib/sandbox/rfb-probe.ts
 * Purpose: Verify that a public Sandbox route can complete a WebSocket/RFB handshake.
 * Problem solved: Distinguishes a working noVNC page from a stream route that serves HTTP but cannot reach Xvnc.
 */

import WebSocket, { type RawData } from "ws";

const RFB_BANNER = /^RFB \d{3}\.\d{3}\n/;

export interface RfbProbeResult {
  healthy: boolean;
  detail: string;
}

export function externalRfbWebSocketUrl(baseUrl: string) {
  const url = new URL("/websockify", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function rawDataText(data: RawData) {
  if (Array.isArray(data)) return Buffer.concat(data).toString("ascii");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("ascii");
  return Buffer.from(data).toString("ascii");
}

export function isRfbProtocolBanner(value: string) {
  return RFB_BANNER.test(value);
}

export async function probeExternalRfb(
  baseUrl: string,
  timeoutMs = 5_000,
): Promise<RfbProbeResult> {
  const websocketUrl = externalRfbWebSocketUrl(baseUrl);

  return new Promise((resolve) => {
    let settled = false;
    let received = "";
    const socket = new WebSocket(websocketUrl, ["binary"]);
    const finish = (result: RfbProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.removeAllListeners();
      if (socket.readyState === WebSocket.OPEN) socket.close(1000);
      else socket.terminate();
      resolve(result);
    };
    const timeout = setTimeout(
      () =>
        finish({
          healthy: false,
          detail: "The external WebSocket did not return an RFB banner in time.",
        }),
      timeoutMs,
    );

    socket.on("message", (data) => {
      if (settled) return;
      received += rawDataText(data);
      if (received.length < 12) return;
      finish(
        isRfbProtocolBanner(received)
          ? {
              healthy: true,
              detail: "The external WebSocket completed an RFB handshake.",
            }
          : {
              healthy: false,
              detail: "The external WebSocket returned an invalid RFB banner.",
            },
      );
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
