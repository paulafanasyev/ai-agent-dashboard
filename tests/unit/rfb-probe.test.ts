/**
 * File: tests/unit/rfb-probe.test.ts
 * Purpose: Verify external noVNC WebSocket URL mapping and real RFB banner detection.
 * Problem solved: Distinguishes a reachable HTTP page from a functioning VNC transport.
 */

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import {
  externalRfbWebSocketUrl,
  isRfbProtocolBanner,
  probeExternalRfb,
} from "@/lib/sandbox/rfb-probe";

const servers: WebSocketServer[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function rfbServer(firstMessage?: string | string[]) {
  const server = new WebSocketServer({ port: 0, path: "/websockify" });
  servers.push(server);
  await once(server, "listening");
  server.on("connection", (socket) => {
    if (Array.isArray(firstMessage)) {
      for (const part of firstMessage) socket.send(part);
    } else if (firstMessage !== undefined) {
      socket.send(firstMessage);
    }
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("external RFB probe", () => {
  it("maps the public noVNC route to its WebSocket endpoint", () => {
    expect(externalRfbWebSocketUrl("https://desktop.example.test/vnc.html")).toBe(
      "wss://desktop.example.test/websockify",
    );
    expect(externalRfbWebSocketUrl("http://localhost:6080")).toBe(
      "ws://localhost:6080/websockify",
    );
  });

  it("accepts only a valid RFB version banner", () => {
    expect(isRfbProtocolBanner("RFB 003.008\n")).toBe(true);
    expect(isRfbProtocolBanner("RFB 003.003\nextra")).toBe(true);
    expect(isRfbProtocolBanner("HTTP/1.1 200 OK\n")).toBe(false);
  });

  it("passes after a real WebSocket and RFB handshake", async () => {
    const baseUrl = await rfbServer(["RFB 003.", "008\n"]);

    await expect(probeExternalRfb(baseUrl, 500)).resolves.toEqual({
      healthy: true,
      detail: "The external WebSocket completed an RFB handshake.",
    });
  });

  it("rejects an HTTP-like response and times out a silent socket", async () => {
    const invalidUrl = await rfbServer("HTTP/1.1 200 OK\n");
    await expect(probeExternalRfb(invalidUrl, 500)).resolves.toMatchObject({
      healthy: false,
      detail: "The external WebSocket returned an invalid RFB banner.",
    });

    const silentUrl = await rfbServer();
    await expect(probeExternalRfb(silentUrl, 20)).resolves.toMatchObject({
      healthy: false,
      detail: "The external WebSocket did not return an RFB banner in time.",
    });
  });
});
