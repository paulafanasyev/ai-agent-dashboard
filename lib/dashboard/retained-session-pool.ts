/**
 * File: lib/dashboard/retained-session-pool.ts
 * Purpose: Keep a bounded most-recently-used set of live Desktop viewers.
 * Problem solved: Switching Desktops no longer tears down every previous noVNC connection.
 */

export const MAX_RETAINED_DESKTOP_SESSIONS = 3;

/**
 * Moves the selected Desktop to the front, removes deleted IDs, and evicts the
 * least recently used viewer once the live-connection limit is reached.
 */
export function retainDesktopSessionIds(
  previousIds: readonly string[],
  activeSessionId: string | null,
  availableSessionIds: readonly string[],
  limit = MAX_RETAINED_DESKTOP_SESSIONS,
): string[] {
  if (limit <= 0) return [];

  const availableIds = new Set(availableSessionIds);
  const retainedIds = previousIds.filter(
    (sessionId, index) =>
      availableIds.has(sessionId) && previousIds.indexOf(sessionId) === index,
  );

  if (!activeSessionId || !availableIds.has(activeSessionId)) {
    return retainedIds.slice(0, limit);
  }

  return [
    activeSessionId,
    ...retainedIds.filter((sessionId) => sessionId !== activeSessionId),
  ].slice(0, limit);
}

/**
 * Keeps retained viewer DOM nodes in their existing order while applying MRU membership changes.
 * Moving a connected iframe in the DOM reloads its browsing context in Chromium, so MRU order must
 * never be used directly as React render order.
 */
export function stabilizeRetainedDesktopSessionIds(
  previousRenderedIds: readonly string[],
  retainedMruIds: readonly string[],
): string[] {
  const retainedIds = new Set(retainedMruIds);
  const renderedIds = previousRenderedIds.filter((sessionId) =>
    retainedIds.has(sessionId),
  );
  const renderedIdSet = new Set(renderedIds);

  return [
    ...renderedIds,
    ...retainedMruIds.filter((sessionId) => !renderedIdSet.has(sessionId)),
  ];
}
