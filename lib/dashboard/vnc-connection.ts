/**
 * File: lib/dashboard/vnc-connection.ts
 * Purpose: Define deterministic timing for the VNC connection state machine.
 * Problem solved: Keeps grace periods, handshake timeouts, and capped backoff testable and consistent.
 */

export const VNC_OFFLINE_GRACE_MS = 8_000;
export const VNC_HANDSHAKE_TIMEOUT_MS = 20_000;
export const VNC_RECONNECT_MAX_DELAY_MS = 15_000;

/** Returns normalized exponential retry timing capped to avoid a reconnect storm. */
export function vncReconnectDelayMs(attempt: number) {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(1_000 * 2 ** normalizedAttempt, VNC_RECONNECT_MAX_DELAY_MS);
}
