/**
 * File: lib/ai/capabilities.ts
 * Purpose: Safely expose model access modes without returning credential values.
 * Problem solved: Lets the client configure available providers without learning server-side secrets.
 */
"use server";

import { getServerModelCapabilities } from "@/lib/ai/runtime-policy";

/** Returns non-sensitive server capabilities; credential values never cross this boundary. */
export async function getModelCapabilities() {
  return getServerModelCapabilities();
}
