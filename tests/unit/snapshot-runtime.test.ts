import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_STARTUP_SCRIPT,
  NOVNC_VERSION,
  WEBSOCKIFY_VERSION,
} from "@/lib/sandbox/snapshot-runtime";

describe("desktop snapshot runtime", () => {
  it("pins the noVNC transport dependencies", () => {
    expect(NOVNC_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(WEBSOCKIFY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("keeps the VNC stack and browser under restart supervision", () => {
    expect(DESKTOP_STARTUP_SCRIPT).toContain("supervise_xvnc &");
    expect(DESKTOP_STARTUP_SCRIPT).toContain("supervise websockify");
    expect(DESKTOP_STARTUP_SCRIPT).toContain("supervise chrome");
    expect(DESKTOP_STARTUP_SCRIPT).toContain("supervise openbox");
  });

  it("is valid bash", () => {
    const result = spawnSync("bash", ["-n"], {
      input: DESKTOP_STARTUP_SCRIPT,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
  });
});
