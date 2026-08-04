/**
 * File: lib/ai/capabilities.ts
 * Purpose: Safely expose model access modes without returning credential values.
 */
"use server";

import { getServerModelCapabilities } from "@/lib/ai/runtime-policy";

export async function getModelCapabilities() {
  return getServerModelCapabilities();
}
