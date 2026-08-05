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

- Production-style two-panel workspace with chat, inline tool visualizations, a collapsible event timeline, a live VNC desktop, and an expanded action inspector.
- Isolated Vercel Sandbox desktops with Chrome, noVNC streaming, computer-use actions, Bash execution, screenshots, and command output.
- Typed, observable event pipeline with action payloads, lifecycle status, duration, aggregate counts, and derived agent state.
- Multiple persistent Desktop sessions and conversations with creation, switching, renaming, pinning, ordering, and protected deletion.
- Stable VNC lifecycle that preserves recent desktop connections across session switches, chat streaming, and responsive layout changes.
- Per-conversation FIFO prompt queues that safely serialize agent work while a Desktop is starting or another task is running.
- BYOK support for Anthropic, Kimi, DeepSeek, and custom OpenAI-compatible providers, including editable Base URLs and per-conversation model selection.
- Runtime diagnostics and recovery covering Sandbox health, VNC readiness, WebSocket handshakes, serialized reconnects, and capped retry backoff.
- Responsive desktop, tablet, and mobile layouts with resizable panels, VNC minimization, and picture-in-picture mode.

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

When a user sends a message, the selected model uses the `computer` tool (screenshot, navigate, click, type, scroll) and the `bash` tool (run shell commands) to interact with the sandbox desktop. The system instruction requires web, weather, search, and other current-information requests to use visible Chrome rather than model memory or a hidden HTTP command. Claude uses Anthropic's native computer-use tools; Kimi and vision-capable custom providers receive screenshots through provider-neutral function tools. DeepSeek V4 is treated as text-only: the screenshot remains visible in the dashboard while the model receives locally extracted text from the same Chrome page, so no unsupported `image_url` part reaches the API. Compatible computer calls receive bounded schema-validated repair for known action aliases and malformed embedded parameters, and the server completes the multi-step tool loop before streaming the final answer.

Tool invocations are normalized into discriminated event records that power the inline cards, debug timeline, metrics, and expanded inspector. Sandbox and noVNC lifecycle actions use the same event envelope while remaining session-owned rather than conversation-owned. Up to three memoized noVNC viewers remain mounted in a most-recently-used pool; only the selected viewer is visible, and none receives chat-message props.

Each browser-local desktop session owns one sandbox ID and runtime generation, plus multiple conversations with independent messages, event metadata, and queued prompts. Starting or switching a conversation preserves the desktop state; creating a new desktop session allocates a separate sandbox. Switching among the three most recent Desktops reveals the existing iframe instead of reconnecting it. Selecting a fourth Desktop evicts only the least-recent viewer connection; its session data and Sandbox identity remain available for reconnection. The composer remains available while the desktop starts or the agent runs: follow-ups enter a visible FIFO queue and dispatch only after the viewer and runtime are ready. Full screenshot payloads are deliberately redacted before `localStorage` persistence to avoid exhausting the browser storage quota.

### Architecture

```
Desktop session ──→ Conversations ──→ AI SDK ──→ Claude / Kimi / DeepSeek / Custom
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

Open **Settings** at the bottom-left of the desktop rail and select **API
Configuration**. Saved configurations are shown first. Use **Add config** to
open the credential dialog, or edit/delete an existing card. The first available
configuration in list order is used automatically; use the custom model menu in
the conversation composer to choose a different profile for that conversation.
New conversations keep the model selected in the previous conversation.

- **Anthropic** defaults to `https://api.anthropic.com/v1` and accepts a Claude model ID.
- **Kimi** defaults to `https://api.kimi.com/coding/v1`; its model ID defaults to `k3`.
- **DeepSeek** defaults to `https://api.deepseek.com`, uses `deepseek-v4-flash` by default, and offers a Thinking mode switch. Thinking is off by default for the most reliable multi-step Desktop automation. Because DeepSeek V4 accepts text input only, the model receives a local text observation of visible Chrome instead of an `image_url` message part.
- **OpenAI-compatible** starts with an empty endpoint and requires a Base URL and model ID.

Every provider in the BYOK dialog exposes an editable **Base URL** field. Saved
requests use that exact normalized endpoint, so compatible gateways can be used
without changing application code. Base URLs must be public HTTPS endpoints;
obvious loopback, private-network, local, and literal IPv6 targets are rejected
by both the browser and `/api/chat`. Existing Anthropic, Kimi, and DeepSeek
profiles that predate this field are migrated to the official defaults above.
`Project Claude` is separate: its endpoint remains server-owned through
`ANTHROPIC_BASE_URL` and is not exposed as a browser-editable profile.

Configuration names are always their model IDs. API keys and profiles are stored
only in the current tab's `sessionStorage`, sent to this app's `/api/chat` route
for server-side forwarding, and removed when the tab is closed.
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
sequential Desktop naming, conversation edit/delete controls, phrase-confirmed
cache deletion, VNC diagnostics, and responsive viewer continuity at desktop and
mobile breakpoints. It also verifies the three-Desktop viewer retention limit,
multi-profile API configuration, editable and migrated per-provider Base URLs,
the custom conversation model picker, DeepSeek Thinking mode persistence, and
tab-scoped credential storage without a live Sandbox credential.

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
