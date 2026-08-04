/**
 * File: vitest.config.mts
 * Purpose: Run deterministic unit tests for dashboard state and event logic.
 * Problem solved: Keeps pure architecture rules fast to validate without a browser or live Sandbox.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
