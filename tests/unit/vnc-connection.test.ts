/**
 * File: tests/unit/vnc-connection.test.ts
 * Purpose: Verify VNC reconnect backoff and invalid-attempt normalization.
 * Problem solved: Prevents retry timing changes from causing reconnect storms or inconsistent delays.
 */

import { describe, expect, it } from "vitest";
import {
  VNC_RECONNECT_MAX_DELAY_MS,
  vncReconnectDelayMs,
} from "@/lib/dashboard/vnc-connection";

describe("VNC reconnect timing", () => {
  it("uses capped exponential backoff", () => {
    expect([0, 1, 2, 3, 4, 5].map(vncReconnectDelayMs)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      VNC_RECONNECT_MAX_DELAY_MS,
      VNC_RECONNECT_MAX_DELAY_MS,
    ]);
  });

  it("normalizes invalid negative and fractional attempt counts", () => {
    expect(vncReconnectDelayMs(-3)).toBe(1_000);
    expect(vncReconnectDelayMs(2.9)).toBe(4_000);
  });
});
