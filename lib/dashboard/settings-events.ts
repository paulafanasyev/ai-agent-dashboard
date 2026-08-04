/**
 * File: lib/dashboard/settings-events.ts
 * Purpose: Let dashboard surfaces request a specific Settings section.
 * Problem solved: Decouples API configuration prompts from the Settings modal implementation.
 */

export const OPEN_API_SETTINGS_EVENT = "agent-desk:open-api-settings";

/** Requests API Settings without coupling the caller to modal state or component placement. */
export function openApiSettings() {
  window.dispatchEvent(new Event(OPEN_API_SETTINGS_EVENT));
}
