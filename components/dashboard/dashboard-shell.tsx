/**
 * File: components/dashboard/dashboard-shell.tsx
 * Purpose: Render the responsive dashboard without owning runtime or session state.
 * Problem solved: Separates visual composition from the page controller and Sandbox lifecycle.
 */
"use client";

import type { UIMessage } from "ai";
import { Bot, Monitor, Plus, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { ChatWorkspace } from "@/components/dashboard/chat-workspace";
import { MobileDesktopSwitcher } from "@/components/dashboard/mobile-desktop-switcher";
import { SessionSidebar } from "@/components/dashboard/session-sidebar";
import { ToolInspector } from "@/components/dashboard/tool-inspector";
import {
  VncViewer,
  type VncDisplayMode,
  type VncViewerState,
} from "@/components/dashboard/vnc-viewer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { ClientModelConfig } from "@/lib/ai/model-config";
import type {
  AgentEvent,
  AgentStatus,
  ChatConversation,
  ChatSession,
  QueuedPrompt,
  ToolEvent,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  isHydrated: boolean;
  isDesktop: boolean;
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  activeConversation: ChatConversation | null;
  streamUrls: Record<string, string>;
  selectedEventId: string | null;
  activeEvent: AgentEvent | null;
  activityEvent: ToolEvent | null;
  agentStatus: AgentStatus;
  modelConfig: ClientModelConfig;
  modelConfigured: boolean;
  vncDisplayMode: VncDisplayMode;
  settingsControl: ReactNode;
  dialogs: ReactNode;
  tutorial: ReactNode;
  onCreateDesktop: () => void;
  onSelectSession: (sessionId: string) => void;
  onRequestDelete: (sessionId: string) => void;
  onRequestRename: (sessionId: string) => void;
  onReorder: (
    draggedSessionId: string,
    targetSessionId: string,
    position: "before" | "after",
  ) => void;
  onTogglePin: (sessionId: string) => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectEvent: (eventId: string | null) => void;
  onConversationChange: (
    sessionId: string,
    conversationId: string,
    messages: UIMessage[],
    events: ToolEvent[],
  ) => void;
  onQueueChange: (
    sessionId: string,
    conversationId: string,
    queuedPrompts: QueuedPrompt[],
  ) => void;
  onStatusChange: (status: AgentStatus) => void;
  onDisplayModeChange: (mode: VncDisplayMode) => void;
  onViewerStateChange: (sessionId: string, state: VncViewerState) => void;
  onRefreshDesktop: () => void;
  modelSignature: string;
  mobileSettings: ReactNode;
}

/**
 * Renders desktop or mobile composition from controller-owned props.
 * This component intentionally contains no Sandbox SDK or persistence logic.
 */
export function DashboardShell(props: DashboardShellProps) {
  if (!props.isHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-zinc-400">
        <div className="flex items-center gap-2 text-xs">
          <Radio className="size-4 animate-pulse text-violet-400" />
          Restoring agent workspace…
        </div>
      </div>
    );
  }

  const header = (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-100 bg-surface px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="size-3.5" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight min-[390px]:inline">
          Agent Desk
        </span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:block">
          <StatusIndicator status={props.agentStatus} />
        </div>
        {!props.isDesktop ? props.mobileSettings : null}
      </div>
    </header>
  );

  if (!props.activeSession || !props.activeConversation) {
    const emptyState = (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <Monitor className="size-4.5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-zinc-900">
          No desktops yet
        </h2>
        <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-500">
          Create an isolated desktop when you are ready to start a new agent
          workspace.
        </p>
        <button
          type="button"
          onClick={props.onCreateDesktop}
          className="mt-4 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-85"
        >
          <Plus className="size-3.5" />
          Create desktop
        </button>
      </section>
    );
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-surface text-zinc-900">
        {header}
        <main className="flex min-h-0 flex-1">
          {props.isDesktop ? (
            <>
              <DesktopRail {...props} activeSessionId={null} />
              {emptyState}
            </>
          ) : emptyState}
        </main>
        {props.dialogs}
        {props.tutorial}
      </div>
    );
  }

  const session = props.activeSession;
  const conversation = props.activeConversation;
  const chat = (
    <ChatWorkspace
      key={`${session.id}-${conversation.id}-${props.modelSignature}`}
      sessionId={session.id}
      conversationId={conversation.id}
      conversationRevision={conversation.revision}
      conversations={session.conversations}
      sandboxId={session.sandboxId}
      initialMessages={conversation.messages}
      initialEvents={conversation.events}
      runtimeEvents={session.runtimeEvents}
      initialQueuedPrompts={conversation.queuedPrompts}
      modelConfig={props.modelConfig}
      modelConfigured={props.modelConfigured}
      connectionReady={session.connectionStatus === "ready"}
      connectionStatus={session.connectionStatus}
      selectedEventId={props.selectedEventId}
      onCreateConversation={props.onCreateConversation}
      onSelectConversation={props.onSelectConversation}
      onSelectEvent={props.onSelectEvent}
      onConversationChange={props.onConversationChange}
      onQueueChange={props.onQueueChange}
      onStatusChange={props.onStatusChange}
    />
  );
  const viewer = (
    <VncViewer
      key={`vnc-viewer-${session.id}`}
      sessionId={session.id}
      sessionTitle={session.title}
      streamUrl={props.streamUrls[session.id] ?? null}
      sandboxId={session.sandboxId}
      generation={session.generation}
      connectionStatus={session.connectionStatus}
      agentStatus={props.agentStatus}
      activityEvent={props.activityEvent}
      displayMode={props.vncDisplayMode}
      showHeader={props.isDesktop}
      onDisplayModeChange={props.onDisplayModeChange}
      onViewerStateChange={props.onViewerStateChange}
      onRefresh={props.onRefreshDesktop}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-zinc-900">
      {header}
      <main className="min-h-0 flex-1">
        <ResizablePanelGroup
          direction="horizontal"
          className="dashboard-responsive-panels h-full"
        >
          <ResizablePanel
            id="dashboard-chat-panel"
            defaultSize={47}
            minSize={34}
            maxSize={66}
            className={cn(
              "dashboard-chat-panel",
              props.vncDisplayMode !== "embedded" &&
                "dashboard-chat-panel-expanded",
            )}
          >
            <div className="flex h-full min-w-0 bg-surface">
              {props.isDesktop ? (
                <DesktopRail {...props} activeSessionId={session.id} />
              ) : null}
              {chat}
            </div>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="dashboard-resize-handle bg-zinc-100"
          />
          <ResizablePanel
            id="dashboard-viewer-panel"
            defaultSize={53}
            minSize={34}
            className={cn(
              "dashboard-viewer-panel",
              props.vncDisplayMode !== "embedded" &&
                "dashboard-viewer-panel-compact",
            )}
          >
            <div className="flex h-full min-w-0 flex-col border-zinc-200 max-md:border-b">
              {!props.isDesktop ? (
                <MobileDesktopSwitcher
                  key="mobile-desktop-switcher"
                  sessions={props.sessions}
                  activeSessionId={session.id}
                  disabled={props.agentStatus !== "idle"}
                  displayMode={props.vncDisplayMode}
                  onCreate={props.onCreateDesktop}
                  onDisplayModeChange={props.onDisplayModeChange}
                  onRefresh={props.onRefreshDesktop}
                  onSelect={props.onSelectSession}
                />
              ) : null}
              {viewer}
              {props.isDesktop ? (
                <ToolInspector
                  key="desktop-tool-inspector"
                  event={props.activeEvent}
                  fill={props.vncDisplayMode !== "embedded"}
                />
              ) : null}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
      {props.dialogs}
      {props.tutorial}
    </div>
  );
}

function DesktopRail(
  props: DashboardShellProps & { activeSessionId: string | null },
) {
  return (
    <SessionSidebar
      sessions={props.sessions}
      activeSessionId={props.activeSessionId}
      disabled={props.agentStatus !== "idle"}
      settingsControl={props.settingsControl}
      onCreate={props.onCreateDesktop}
      onSelect={props.onSelectSession}
      onRequestDelete={props.onRequestDelete}
      onRequestRename={props.onRequestRename}
      onReorder={props.onReorder}
      onTogglePin={props.onTogglePin}
    />
  );
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium capitalize text-zinc-600">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "idle" && "bg-emerald-500",
          status === "thinking" && "animate-pulse bg-violet-500",
          status === "executing" && "animate-pulse bg-amber-500",
        )}
      />
      {status}
    </span>
  );
}
