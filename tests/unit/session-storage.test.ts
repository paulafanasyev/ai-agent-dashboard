/**
 * File: tests/unit/session-storage.test.ts
 * Purpose: Verify versioned Session persistence, restoration, redaction, and empty-state behavior.
 * Problem solved: Protects browser-local history without restoring stale Ready state or oversized screenshots.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  createEmptySession,
  getNextDesktopName,
  loadSessions,
  persistSessions,
} from "@/lib/dashboard/session-storage";
import { finishRuntimeEvent, startRuntimeEvent } from "@/lib/dashboard/events";

describe("session storage", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it("increments default Desktop names from the current sequence", () => {
    expect(getNextDesktopName([])).toBe("Desktop 1");
    expect(getNextDesktopName(["Desktop 1"])).toBe("Desktop 2");
    expect(
      getNextDesktopName(["Desktop 1", "QA desktop", "Desktop 3"]),
    ).toBe("Desktop 4");
  });

  it("round-trips isolated conversations and runtime lifecycle events", () => {
    const session = createEmptySession("Research desktop");
    session.conversations[0].apiConfigId = "deepseek-work";
    const runtimeEvent = startRuntimeEvent(
      session.id,
      "sandbox_create",
      { source: "system" },
      100,
    );
    session.runtimeEvents = [
      finishRuntimeEvent(runtimeEvent, "completed", { message: "ready" }, 180),
    ];
    session.connectionStatus = "ready";

    persistSessions([session]);
    const restored = loadSessions();

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      id: session.id,
      title: "Research desktop",
      connectionStatus: "uninitialized",
    });
    expect(restored[0].runtimeEvents[0]).toMatchObject({
      action: "sandbox_create",
      status: "completed",
      durationMs: 80,
    });
    expect(restored[0].conversations[0].apiConfigId).toBe("deepseek-work");
  });

  it("migrates conversations without an API profile selection", () => {
    const session = createEmptySession("Legacy desktop");
    const stored = JSON.parse(JSON.stringify([session]));
    delete stored[0].conversations[0].apiConfigId;
    values.set(SESSION_STORAGE_KEY, JSON.stringify(stored));

    expect(loadSessions()[0].conversations[0].apiConfigId).toBeNull();
  });

  it("treats an explicit empty snapshot as an intentional empty workspace", () => {
    values.set(SESSION_STORAGE_KEY, "[]");
    values.set(ACTIVE_SESSION_STORAGE_KEY, "missing");
    expect(loadSessions()).toEqual([]);
  });
});
