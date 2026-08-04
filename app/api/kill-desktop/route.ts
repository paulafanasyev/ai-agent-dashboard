/**
 * File: app/api/kill-desktop/route.ts
 * Purpose: Stop a remote desktop sandbox through an HTTP endpoint.
 * Problem solved: Releases session compute safely after an explicit destructive action.
 */
import { killDesktop } from "@/lib/sandbox/utils";

async function handleKillDesktop(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  console.log(`Kill desktop request received via ${request.method} for ID: ${sandboxId}`);

  if (!sandboxId) {
    return new Response("No sandboxId provided", { status: 400 });
  }

  try {
    await killDesktop(sandboxId);
    return new Response("Desktop killed successfully", { status: 200 });
  } catch (error) {
    console.error(`Failed to kill desktop with ID: ${sandboxId}`, error);
    return new Response("Failed to kill desktop", { status: 500 });
  }
}

/** Stops the explicitly requested Sandbox; destructive cleanup is intentionally POST-only. */
export async function POST(request: Request) {
  return handleKillDesktop(request);
}
