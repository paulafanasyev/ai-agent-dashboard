/**
 * File: lib/dashboard/activity.ts
 * Purpose: Describe agent events consistently across chat, VNC, and inspector surfaces.
 * Problem solved: Clearly separates visible desktop actions from background commands without duplicating labels.
 */
import type { AgentEvent } from "./types";

const computerActionLabels: Record<string, string> = {
  screenshot: "Reading the current screen",
  wait: "Waiting for the page to respond",
  left_click: "Clicking",
  double_click: "Double-clicking",
  right_click: "Right-clicking",
  middle_click: "Middle-clicking",
  triple_click: "Triple-clicking",
  mouse_move: "Moving the pointer",
  type: "Typing into the desktop",
  key: "Sending a keyboard shortcut",
  scroll: "Scrolling the page",
  left_click_drag: "Dragging an item",
  hold_key: "Holding a key",
  cursor_position: "Reading the pointer position",
  left_mouse_down: "Pressing the mouse button",
  left_mouse_up: "Releasing the mouse button",
  unknown: "Operating the remote desktop",
};

function truncate(value: string, maxLength = 72) {
  const normalized = value.replaceAll("\n", " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}…`
    : normalized;
}

/** Classifies an event as visible Desktop work, background work, or runtime lifecycle activity. */
export function eventSurface(event: AgentEvent) {
  if (event.kind === "runtime") return "Desktop runtime";
  return event.kind === "bash"
    ? "Background command"
    : "Visible desktop action";
}

/** Produces the shared user-facing activity description used across Chat, VNC, and Inspector. */
export function describeAgentEvent(event: AgentEvent) {
  if (event.kind === "runtime") {
    return {
      title: eventLabelForRuntime(event.action),
      detail: event.payload.message ?? event.result?.message ?? null,
    };
  }
  if (event.kind === "bash") {
    return {
      title: "Running a terminal command",
      detail: truncate(event.payload.command),
    };
  }

  const coordinate = event.payload.coordinate;
  const coordinateDetail = coordinate
    ? `Position (${coordinate[0]}, ${coordinate[1]})`
    : null;
  const detail =
    event.action === "type" && event.payload.text
      ? truncate(event.payload.text)
      : event.action === "scroll" && event.payload.scrollDirection
        ? `${event.payload.scrollDirection} ${event.payload.scrollAmount ?? ""}`.trim()
        : coordinateDetail;

  return {
    title: computerActionLabels[event.action] ?? "Operating the remote desktop",
    detail,
  };
}

function eventLabelForRuntime(action: string) {
  const labels: Record<string, string> = {
    sandbox_create: "Creating the isolated desktop",
    sandbox_reconnect: "Reconnecting to the desktop",
    sandbox_health_check: "Checking desktop health",
    sandbox_destroy: "Destroying the isolated desktop",
    vnc_connect: "Connecting the live desktop",
    vnc_disconnect: "Live desktop disconnected",
  };
  return labels[action] ?? "Updating the desktop runtime";
}
