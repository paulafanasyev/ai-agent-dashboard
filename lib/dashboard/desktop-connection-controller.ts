/**
 * File: lib/dashboard/desktop-connection-controller.ts
 * Purpose: Centralize retry counters and timers for one noVNC connection.
 * Problem solved: Prevents overlapping retries and makes connection cleanup deterministic per Desktop.
 */

export interface ConnectionController {
  retryAttempt: number;
  retryTimer: number | null;
  offlineTimer: number | null;
  handshakeTimer: number | null;
  pendingConnect: boolean;
}

export type ConnectionTimer =
  | "retryTimer"
  | "offlineTimer"
  | "handshakeTimer";

/** Returns the stable timer/retry controller owned by one Desktop Session. */
export function connectionControllerFor(
  controllers: Map<string, ConnectionController>,
  sessionId: string,
) {
  const existing = controllers.get(sessionId);
  if (existing) return existing;
  const controller: ConnectionController = {
    retryAttempt: 0,
    retryTimer: null,
    offlineTimer: null,
    handshakeTimer: null,
    pendingConnect: false,
  };
  controllers.set(sessionId, controller);
  return controller;
}

/** Cancels one controller timer and clears its stored ID atomically. */
export function clearConnectionTimer(
  controller: ConnectionController,
  timer: ConnectionTimer,
) {
  const timerId = controller[timer];
  if (timerId !== null) window.clearTimeout(timerId);
  controller[timer] = null;
}

/** Cancels every scheduled connection transition before deletion, refresh, or unmount. */
export function clearConnectionController(controller: ConnectionController) {
  clearConnectionTimer(controller, "retryTimer");
  clearConnectionTimer(controller, "offlineTimer");
  clearConnectionTimer(controller, "handshakeTimer");
}
