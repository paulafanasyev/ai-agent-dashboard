import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SESSION_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  createEmptySession,
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

  it("round-trips isolated conversations and runtime lifecycle events", () => {
    const session = createEmptySession("Research desktop");
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
  });

  it("treats an explicit empty snapshot as an intentional empty workspace", () => {
    values.set(SESSION_STORAGE_KEY, "[]");
    values.set(ACTIVE_SESSION_STORAGE_KEY, "missing");
    expect(loadSessions()).toEqual([]);
  });
});
