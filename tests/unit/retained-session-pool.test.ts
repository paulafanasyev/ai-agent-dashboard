/**
 * File: tests/unit/retained-session-pool.test.ts
 * Purpose: Verify the bounded Desktop viewer retention policy.
 * Problem solved: Prevents session switching from regressing into iframe teardown or unbounded retention.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_RETAINED_DESKTOP_SESSIONS,
  retainDesktopSessionIds,
  stabilizeRetainedDesktopSessionIds,
} from "@/lib/dashboard/retained-session-pool";

describe("retainDesktopSessionIds", () => {
  it("keeps the three most recently selected Desktop sessions", () => {
    let retained: string[] = [];
    const available = ["one", "two", "three", "four"];

    for (const sessionId of available) {
      retained = retainDesktopSessionIds(retained, sessionId, available);
    }

    expect(retained).toEqual(["four", "three", "two"]);
    expect(retained).toHaveLength(MAX_RETAINED_DESKTOP_SESSIONS);
  });

  it("moves an already retained Desktop to the front without duplication", () => {
    expect(
      retainDesktopSessionIds(
        ["three", "two", "one"],
        "one",
        ["one", "two", "three"],
      ),
    ).toEqual(["one", "three", "two"]);
  });

  it("removes deleted sessions while preserving recent order", () => {
    expect(
      retainDesktopSessionIds(
        ["three", "two", "one"],
        "three",
        ["one", "three"],
      ),
    ).toEqual(["three", "one"]);
  });
});

describe("stabilizeRetainedDesktopSessionIds", () => {
  it("preserves mounted viewer order while selection changes MRU order", () => {
    expect(
      stabilizeRetainedDesktopSessionIds(
        ["one", "two", "three"],
        ["one", "three", "two"],
      ),
    ).toEqual(["one", "two", "three"]);
  });

  it("removes evicted viewers and appends newly retained viewers", () => {
    expect(
      stabilizeRetainedDesktopSessionIds(
        ["one", "two", "three"],
        ["four", "one", "three"],
      ),
    ).toEqual(["one", "three", "four"]);
  });
});
