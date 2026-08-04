<!--
File: docs/adr/001-desktop-runtime-strategy.md
Purpose: Record the chosen desktop runtime boundary and migration strategy.
Problem solved: Explains why the starter runtime remains in place and how E2B can replace it without UI rewrites.
-->

# ADR 001: Preserve the starter runtime behind a provider boundary

- Status: Accepted
- Date: 2026-08-03

## Context

The required starter project uses Vercel Sandbox for desktop creation, computer
actions, shell commands, and noVNC streaming. The assignment appendix names E2B
as the target runtime and expects an isolated temporary VM for every chat
session.

Replacing the starter implementation in place would discard a working baseline
and mix provider migration with dashboard state work. Keeping provider-specific
SDK objects in React state would also make session lifecycle and testing harder.

## Decision

Keep the verified Vercel Sandbox path as the production runtime and isolate it
inside `lib/sandbox`. The dashboard owns a provider-independent, discriminated
event model: conversations store computer and bash tool events, while each
Desktop session stores Sandbox and noVNC lifecycle events. Both streams are
merged chronologically for the debug timeline and inspector.

The runtime will be selected with server-side configuration. Provider SDK
objects and credentials must not cross the server boundary or be persisted in
browser storage.

## Consequences

- The imported demo remains runnable while the dashboard is developed.
- A future E2B adapter can share the tool contracts and lifecycle instrumentation.
- Session-to-VM ownership can be enforced above either provider.
- Provider capability differences would require explicit mapping and contract tests.
- Runtime lifecycle history is capped per session to protect browser storage.
