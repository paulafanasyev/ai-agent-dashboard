Author: Cheng LIANG(Ray)

# AI Agent Dashboard

<p align="center">
  An observable, session-aware computer-use agent dashboard built from Vercel Labs' AI SDK Computer Use demo.
</p>

**Live deployment:** [ai-agent-dashboard-fawn-ten.vercel.app](https://ai-agent-dashboard-fawn-ten.vercel.app)

The upstream Vercel Sandbox execution path is preserved behind the server-side
runtime modules. Dashboard observability, isolated desktop sessions, typed tool
and runtime events, responsive layouts, automated tests, and first-run guidance
are implemented on `main`.

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-it-works"><strong>How It Works</strong></a> ·
  <a href="repowiki.md"><strong>Repository Wiki</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Features

- Streaming text responses powered by the [AI SDK](https://sdk.vercel.ai/docs).
- Local Project Claude or hosted BYOK through Anthropic, Kimi, and OpenAI-compatible providers, all with computer-use and bash tool capabilities.
- One provider dropdown for browser-side BYOK; the key is kept in tab-scoped `sessionStorage`.
- Production-style two-panel workspace: chat and sessions on the left, isolated desktop and tool inspector on the right.
- Mobile stacked workspace with the live VNC desktop above the always-available conversation composer and desktop switching at the top.
- One-click VNC minimization and draggable, viewport-constrained picture-in-picture without recreating the remote desktop iframe.
- Typed event projection with action counts, `idle / thinking / executing` status, inline tool cards, and a selectable debug timeline.
- Unified instrumentation for Sandbox and noVNC lifecycle events, including ID, timestamp, status, and duration.
- Copy controls on user and agent text with inline confirmation and toast feedback.
- Visible-first browser automation plus a live VNC activity overlay that distinguishes desktop actions from background commands.
- Multiple desktop sessions, each with reusable VNC state and switchable local conversation history.
- Idempotent conversation creation that focuses the composer instead of accumulating empty conversations.
- Named desktop creation plus persistent pinning, renaming, drag ordering, a width-adjustable desktop rail, and confirmation-protected deletion down to a true empty state.
- Live desktop health states backed by Sandbox, Xvnc, noVNC, and viewer-handshake checks; `Ready` is never restored from browser storage.
- Server-backed VNC Diagnostics in Settings checks deployment authentication, snapshot presence, Sandbox reachability, ports 5900/6080, and a real external WebSocket/RFB handshake without exposing credential values.
- A per-desktop connection controller serializes health checks and reconnects, preserves the iframe through brief disconnects, and retries with capped exponential backoff.
- Desktop sandboxes run for up to 30 minutes, while a startup script refreshed on allocation supervises Xvnc, openbox, websockify, and Chrome; pinned noVNC/websockify releases make rebuilt snapshots reproducible.
- Persistent per-conversation FIFO task queues: prompts entered before Desktop readiness or during an active run execute automatically when safe.
- Frame-coalesced scrolling and dragging, throttled live-state projection, idle-time persistence, lazy screenshot decoding, and a memoized VNC viewer isolated from token-by-token chat rendering.
- Four persistent, neutral-dark interface themes with researched Vercel, Vue, Xcode, and GitHub accent and text palettes, plus live preview in Settings.
- Remote desktop environment running in a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) with Chrome, a window manager, and VNC streaming.
- [shadcn/ui](https://ui.shadcn.com/) components for a modern, responsive UI powered by [Tailwind CSS](https://tailwindcss.com).
- Built with the latest [Next.js](https://nextjs.org) App Router.

## Upstream Baseline

This repository preserves the Git history from
[`vercel-labs/ai-sdk-computer-use`](https://github.com/vercel-labs/ai-sdk-computer-use).
The imported baseline is commit `ed103da`; the original repository is configured
locally as the `upstream` remote.

The assignment appendix names E2B as the target desktop provider while the
starter project uses Vercel Sandbox. The decision and migration boundary are
recorded in [ADR 001](docs/adr/001-desktop-runtime-strategy.md).

## How It Works

For a detailed explanation of module boundaries, runtime flows, state ownership,
security decisions, and extension points, see the
[Repository Architecture Wiki](repowiki.md).

The app spins up a Vercel Sandbox from a pre-built snapshot that includes:

- **Xvnc** — a virtual X11 display server
- **openbox** — a lightweight window manager
- **noVNC + websockify** — streams the desktop to the browser via WebSocket
- **Google Chrome** — auto-launched so the AI agent has a browser ready
- **xdotool + ImageMagick** — for mouse/keyboard control and screenshots

When a user sends a message, the selected model uses the `computer` tool (screenshot, click, type, scroll) and the `bash` tool (run shell commands) to interact with the sandbox desktop. Web, weather, search, and other current-information requests are deterministically routed to `computer` for the first step, so the agent must inspect the visible browser instead of answering from memory or using a hidden HTTP command. Claude uses Anthropic's native computer-use tools; Kimi K3 uses provider-neutral function tools and receives screenshots as multimodal input.

Tool invocations are normalized into discriminated event records that power the inline cards, debug timeline, metrics, and expanded inspector. Sandbox and noVNC lifecycle actions use the same event envelope while remaining session-owned rather than conversation-owned. The memoized noVNC viewer is displayed in a horizontally resizable panel and receives no chat-message props.

Each browser-local desktop session owns one sandbox ID and runtime generation, plus multiple conversations with independent messages, event metadata, and queued prompts. Starting or switching a conversation preserves the desktop state; creating a new desktop session allocates a separate sandbox. The composer remains available while the desktop starts or the agent runs: follow-ups enter a visible FIFO queue and dispatch only after the viewer and runtime are ready. Full screenshot payloads are deliberately redacted before `localStorage` persistence to avoid exhausting the browser storage quota.

### Architecture

```
Desktop session ──→ Conversations ──→ AI SDK ──→ Claude / Kimi K3
     │                    │                            │
     │                    └─→ typed tool events ←─────┤
     ├── runtime events ───────────────┐               ↓
     ├── localStorage                  ├─ debug timeline / inspector
     └── sandbox id ──→ memoized VNC viewer ←── Vercel Sandbox
```

## Deploy Your Own

The reviewed production build is available at the [live deployment](https://ai-agent-dashboard-fawn-ten.vercel.app).
Deploy your own copy from this repository with the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?project-name=ai-agent-dashboard&repository-name=ai-agent-dashboard&repository-url=https%3A%2F%2Fgithub.com%2FCHENG-LIANG1%2Fai-agent-dashboard&demo-title=AI%20Agent%20Dashboard&demo-url=https%3A%2F%2Fai-agent-dashboard-fawn-ten.vercel.app&env=SANDBOX_SNAPSHOT_ID)

## Running Locally

### Prerequisites

- Node.js 20.19+
- A [Vercel](https://vercel.com) account (for Sandbox access)
- A personal provider API key supplied through BYOK; local development may instead use an [Anthropic API key](https://console.anthropic.com/) from `.env.local`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Vercel credentials

Install the [Vercel CLI](https://vercel.com/docs/cli) and link your project:

```bash
pnpm install -g vercel
vercel link
vercel env pull
```

This creates a `.env.local` file with `VERCEL_OIDC_TOKEN` for Sandbox authentication.

Alternatively, set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` manually in your `.env.local`.

### 3. Create a sandbox snapshot

The snapshot pre-installs the desktop environment (Xvnc, Chrome, openbox, noVNC, xdotool, ImageMagick) so sandboxes boot in seconds. Its startup script supervises each long-running desktop process, and the noVNC/websockify versions are pinned for reproducible streams.

```bash
npx tsx lib/sandbox/create-snapshot.ts
```

This takes ~10 minutes. When done, it outputs a snapshot ID. Add it to your `.env.local`:

```
SANDBOX_SNAPSHOT_ID=snap_xxxxxxxxxxxxx
```

### 4. Add your local Anthropic API key

```
ANTHROPIC_API_KEY=sk-ant-...
```

`Project Claude` is available only during local development. Production and
other hosted builds are BYOK-only even if a shared Anthropic key is present in
their environment, preventing public visitors from spending the operator's
Claude credits.

To use an Anthropic-compatible gateway, configure its Messages API prefix and
the model ID exposed by that gateway:

```
ANTHROPIC_BASE_URL=https://www.packyapi.ai/v1
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the computer use agent.

### Use BYOK

Open **Settings** at the bottom-left of the desktop rail, select **BYOK**, then
choose a provider from the single dropdown. Valid changes are saved
automatically; there is no separate save action.

- **Anthropic** uses the official Messages API and accepts a Claude model ID.
- **Kimi** is a preset for `https://api.kimi.com/coding/v1`; its model ID defaults to `k3`.
- **OpenAI-compatible** accepts a public HTTPS Base URL and model ID.

The key is stored only in the current tab's `sessionStorage`, sent to this app's
`/api/chat` route for server-side forwarding, and removed when the tab is closed.
Only enter a personal key on a deployment whose source and operator you trust.

### Quality checks

```bash
pnpm check
```

This runs ESLint, TypeScript validation, deterministic unit tests, and a
production build—the same core checks used in CI. Critical responsive UI flows
also run in Chromium:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite covers first-open tutorial persistence, replay from Settings,
named Desktop creation, phrase-confirmed cache deletion, and VNC diagnostics at
desktop and mobile breakpoints. It also verifies the hosted BYOK-only provider
dropdown and tab-scoped Anthropic key storage without a live Sandbox credential.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Local only | Anthropic API key for local-development Project Claude; hosted builds require BYOK |
| `ANTHROPIC_BASE_URL` | No | Anthropic-compatible Messages API prefix; defaults to the official Anthropic API |
| `ANTHROPIC_MODEL` | No | Provider model ID; defaults to the starter project's Claude Sonnet 4.5 model |
| `SANDBOX_SNAPSHOT_ID` | Yes | Vercel Sandbox snapshot with the desktop environment |
| `NEXT_PUBLIC_APP_URL` | No | Canonical deployment URL used for social metadata; defaults to `http://localhost:3000` |
| `VERCEL_OIDC_TOKEN` | Yes* | Auto-set by `vercel env pull` for Sandbox auth |
| `VERCEL_TOKEN` | Alt* | Alternative to OIDC — a Vercel personal access token |
| `VERCEL_TEAM_ID` | Alt* | Required with `VERCEL_TOKEN` |
| `VERCEL_PROJECT_ID` | Alt* | Required with `VERCEL_TOKEN` |

\* Either `VERCEL_OIDC_TOKEN` (via `vercel env pull`) or the `VERCEL_TOKEN` + team/project IDs are required for Sandbox authentication.
