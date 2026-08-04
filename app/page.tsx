/**
 * File: app/page.tsx
 * Purpose: Compose the session-aware, responsive AI agent dashboard.
 * Problem solved: Keeps page composition separate from session, model, and desktop controllers.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DesktopDialogStack } from "@/components/dashboard/desktop-dialogs";
import { OnboardingTutorial } from "@/components/dashboard/onboarding-tutorial";
import type { VncDisplayMode } from "@/components/dashboard/vnc-viewer";
import { DashboardSettings } from "@/components/model-settings";
import { mergeEventTimeline } from "@/lib/dashboard/events";
import type { AgentStatus } from "@/lib/dashboard/types";
import { useDashboardModelConfig } from "@/lib/dashboard/use-dashboard-model-config";
import { useDashboardPersistence } from "@/lib/dashboard/use-dashboard-persistence";
import { useDashboardSessionActions } from "@/lib/dashboard/use-dashboard-session-actions";
import { useDashboardTutorial } from "@/lib/dashboard/use-dashboard-tutorial";
import { useDesktopLayout } from "@/lib/dashboard/use-desktop-layout";
import { useDesktopRuntime } from "@/lib/dashboard/use-desktop-runtime";
import type { VncClientDiagnostics } from "@/lib/sandbox/diagnostics";

/** Composes browser persistence, model, Session, and Desktop controllers into the presentation shell. */
export default function DashboardPage() {
  const {
    sessions,
    setSessions,
    sessionsRef,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    modelConfig,
    setModelConfig,
    isHydrated,
    clearLocalDashboardData,
  } = useDashboardPersistence();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [vncDisplayMode, setVncDisplayMode] =
    useState<VncDisplayMode>("embedded");
  const isDesktop = useDesktopLayout();
  const { isTutorialOpen, closeTutorial, replayTutorial } =
    useDashboardTutorial(isHydrated);

  const desktopRuntime = useDesktopRuntime({
    sessions,
    setSessions,
    activeSessionId,
    isHydrated,
  });
  const {
    streamUrls,
    streamUrlsRef,
    viewerReadyRef,
    verifyDesktop,
    removeStreamUrl,
    destroyDesktop,
    refreshActiveDesktop,
    runActiveDesktopDiagnostics,
    handleViewerStateChange,
  } = desktopRuntime;

  const sessionActions = useDashboardSessionActions({
    agentStatus,
    setAgentStatus,
    setSelectedEventId,
    setSessions,
    sessionsRef,
    activeSessionIdRef,
    setActiveSessionId,
    streamUrlsRef,
    viewerReadyRef,
    verifyDesktop,
    destroyDesktop,
    removeStreamUrl,
  });
  const {
    isCreateDesktopOpen,
    deleteDesktopId,
    renameDesktopId,
    createSession,
    requestCreateSession,
    closeCreateSession,
    createConversation,
    selectConversation,
    selectSession,
    deleteSession,
    requestDeleteSession,
    closeDeleteSession,
    requestRenameSession,
    closeRenameSession,
    renameSession,
    togglePinSession,
    reorderSessions,
    updateConversation,
    updatePromptQueue,
  } = sessionActions;

  const {
    projectClaudeAvailable,
    modelConfigured,
    modelSignature,
    updateModelConfig,
  } = useDashboardModelConfig({
    modelConfig,
    setModelConfig,
    setSessions,
    activeSessionIdRef,
    setSelectedEventId,
  });

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const activeConversation = useMemo(
    () =>
      activeSession?.conversations.find(
        (conversation) =>
          conversation.id === activeSession.activeConversationId,
      ) ?? null,
    [activeSession],
  );

  const clearAllData = useCallback(async () => {
    if (agentStatus !== "idle") {
      toast.info("Stop the active run before clearing cached data.");
      return;
    }

    const currentSessions = [...sessionsRef.current];
    await Promise.all(
      currentSessions.map(async (session) => {
        if (session.sandboxId) {
          await destroyDesktop(session.id, session.sandboxId);
        }
        removeStreamUrl(session.id);
      }),
    );

    viewerReadyRef.current.clear();
    clearLocalDashboardData();
    setSelectedEventId(null);
    setAgentStatus("idle");
    setVncDisplayMode("embedded");
    toast.success("All sessions, chats, and cached settings were deleted");
  }, [
    agentStatus,
    clearLocalDashboardData,
    destroyDesktop,
    removeStreamUrl,
    sessionsRef,
    viewerReadyRef,
  ]);

  const activeEvents = useMemo(
    () =>
      activeSession && activeConversation
        ? mergeEventTimeline(
            activeConversation.events,
            activeSession.runtimeEvents,
          )
        : [],
    [activeConversation, activeSession],
  );
  const activeEvent = useMemo(
    () =>
      activeConversation
        ? activeEvents.find((event) => event.id === selectedEventId) ??
          activeEvents.at(-1) ??
          null
        : null,
    [activeConversation, activeEvents, selectedEventId],
  );
  const activityEvent = useMemo(
    () =>
      activeConversation?.events.findLast(
        (event) => event.status === "pending",
      ) ??
      activeConversation?.events.at(-1) ??
      null,
    [activeConversation?.events],
  );
  const vncClientDiagnostics = useMemo<VncClientDiagnostics>(
    () => ({
      desktopTitle: activeSession?.title ?? null,
      sandboxId: activeSession?.sandboxId ?? null,
      connectionStatus: activeSession?.connectionStatus ?? "no_desktop",
      streamAttached: activeSession
        ? Boolean(streamUrls[activeSession.id])
        : false,
      viewerReady: activeSession
        ? viewerReadyRef.current.has(activeSession.id)
        : false,
    }),
    [activeSession, streamUrls, viewerReadyRef],
  );

  const settingsControl = useMemo(
    () => (
      <DashboardSettings
        config={modelConfig}
        modelDisabled={agentStatus !== "idle"}
        trigger="rail"
        onConfigChange={updateModelConfig}
        onReplayTutorial={replayTutorial}
        onClearAllData={clearAllData}
        vncClientDiagnostics={vncClientDiagnostics}
        onRunVncDiagnostics={runActiveDesktopDiagnostics}
        onReconnectVnc={refreshActiveDesktop}
        projectClaudeAvailable={projectClaudeAvailable}
      />
    ),
    [
      agentStatus,
      clearAllData,
      modelConfig,
      projectClaudeAvailable,
      refreshActiveDesktop,
      replayTutorial,
      runActiveDesktopDiagnostics,
      updateModelConfig,
      vncClientDiagnostics,
    ],
  );

  const dialogs = (
    <DesktopDialogStack
      sessions={sessions}
      createOpen={isCreateDesktopOpen}
      deleteSessionId={deleteDesktopId}
      renameSessionId={renameDesktopId}
      onCloseCreate={closeCreateSession}
      onCreate={createSession}
      onCloseDelete={closeDeleteSession}
      onDelete={deleteSession}
      onCloseRename={closeRenameSession}
      onRename={renameSession}
    />
  );
  const tutorial = (
    <OnboardingTutorial
      open={isTutorialOpen}
      onComplete={closeTutorial}
      onSkip={closeTutorial}
    />
  );
  const mobileSettings = (
    <DashboardSettings
      config={modelConfig}
      modelDisabled={agentStatus !== "idle"}
      trigger="icon"
      onConfigChange={updateModelConfig}
      onReplayTutorial={replayTutorial}
      onClearAllData={clearAllData}
      vncClientDiagnostics={vncClientDiagnostics}
      onRunVncDiagnostics={runActiveDesktopDiagnostics}
      onReconnectVnc={refreshActiveDesktop}
      projectClaudeAvailable={projectClaudeAvailable}
    />
  );

  return (
    <DashboardShell
      isHydrated={isHydrated}
      isDesktop={isDesktop}
      sessions={sessions}
      activeSession={activeSession}
      activeConversation={activeConversation}
      streamUrls={streamUrls}
      selectedEventId={selectedEventId}
      activeEvent={activeEvent}
      activityEvent={activityEvent}
      agentStatus={agentStatus}
      modelConfig={modelConfig}
      modelConfigured={modelConfigured}
      vncDisplayMode={vncDisplayMode}
      settingsControl={settingsControl}
      dialogs={dialogs}
      tutorial={tutorial}
      mobileSettings={mobileSettings}
      modelSignature={modelSignature}
      onCreateDesktop={requestCreateSession}
      onSelectSession={selectSession}
      onRequestDelete={requestDeleteSession}
      onRequestRename={requestRenameSession}
      onReorder={reorderSessions}
      onTogglePin={togglePinSession}
      onCreateConversation={createConversation}
      onSelectConversation={selectConversation}
      onSelectEvent={setSelectedEventId}
      onConversationChange={updateConversation}
      onQueueChange={updatePromptQueue}
      onStatusChange={setAgentStatus}
      onDisplayModeChange={setVncDisplayMode}
      onViewerStateChange={handleViewerStateChange}
      onRefreshDesktop={refreshActiveDesktop}
    />
  );
}
