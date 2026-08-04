/**
 * File: lib/dashboard/settings-events.ts
 * Purpose: Let dashboard surfaces request a specific Settings section.
 */

export const OPEN_API_SETTINGS_EVENT = "agent-desk:open-api-settings";

export function openApiSettings() {
  window.dispatchEvent(new Event(OPEN_API_SETTINGS_EVENT));
}
