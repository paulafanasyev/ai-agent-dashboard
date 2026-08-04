/**
 * File: tests/e2e/dashboard.spec.ts
 * Purpose: Exercise critical Dashboard flows in desktop and mobile Chromium.
 * Problem solved: Catches user-visible regressions in onboarding, settings, sessions, diagnostics, and hosted BYOK.
 */

import { expect, test } from "@playwright/test";

const tutorialKey = "agent-desk-tutorial-v1-complete";
const themeKey = "agent-desk-theme";

test("first open tutorial can be skipped and stays completed", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Agent Desk" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.locator("[data-tutorial-overlay]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("[data-tutorial-overlay]")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), tutorialKey))
    .toBe("complete");
});

test("settings replays the tutorial", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: /Tutorial/ }).click();
  await page.getByRole("button", { name: "Start tutorial" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Agent Desk" }),
  ).toBeVisible();
});

test("theme menu excludes Codex and migrates its cached preference", async ({
  page,
}) => {
  await page.addInitScript(
    ({ tutorialStorageKey, themeStorageKey }) => {
      localStorage.setItem(tutorialStorageKey, "complete");
      localStorage.setItem(themeStorageKey, "codex");
    },
    { tutorialStorageKey: tutorialKey, themeStorageKey: themeKey },
  );
  await page.goto("/");

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), themeKey))
    .toBe("vercel");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "vercel");

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("button", { name: "Choose interface theme" }).click();
  const themeList = page.getByRole("listbox", { name: "Interface themes" });
  await expect(themeList.getByRole("option")).toHaveCount(4);
  await expect(themeList.getByRole("option", { name: /Codex/ })).toHaveCount(0);
});

test("buttons do not show automatic tooltips", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");

  const settingsButton = page.getByRole("button", { name: "Open settings" });
  await expect(settingsButton).not.toHaveAttribute("title");
  await settingsButton.hover();
  await page.waitForTimeout(500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await settingsButton.focus();
  await page.waitForTimeout(250);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("shows desktop details when hovering its icon", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Mobile navigation has no hover-only Desktop rail.",
  );
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to Desktop 1" }).hover();
  const tooltip = page.getByRole("tooltip", { name: "Desktop 1 details" });
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText("Not started", { exact: true })).toBeVisible();
  await expect(tooltip.getByText("1", { exact: true })).toBeVisible();
  await expect(tooltip.getByText("Not allocated", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).hover();
  await expect(tooltip).toHaveCount(0);
});

test("keeps the VNC viewer mounted across the responsive breakpoint", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/");

  const viewer = page.locator('[data-tutorial="desktop-viewer"]');
  await expect(viewer).toBeVisible();
  await viewer.evaluate((element) =>
    element.setAttribute("data-resize-sentinel", "same-node"),
  );

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(
    page.getByRole("button", { name: /Switch desktop\. Current desktop:/ }),
  ).toBeVisible();
  await expect(viewer).toHaveAttribute("data-resize-sentinel", "same-node");
  const chat = page.locator('[data-tutorial="chat-workspace"]');
  await expect
    .poll(async () => {
      const [viewerBox, chatBox] = await Promise.all([
        viewer.boundingBox(),
        chat.boundingBox(),
      ]);
      return Boolean(
        viewerBox &&
          chatBox &&
          viewerBox.y + viewerBox.height <= chatBox.y + 1,
      );
    })
    .toBe(true);

  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByRole("button", { name: "New desktop" })).toBeVisible();
  await expect(viewer).toHaveAttribute("data-resize-sentinel", "same-node");
});

test("unconfigured composer links to API settings through a notification", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");

  await page.getByRole("button", { name: "Configure API key" }).click();
  await expect(page.getByText("API key required", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Configure", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "API Configuration" }),
  ).toBeVisible();
  await expect(page.getByLabel("Provider")).toBeVisible();
});

test("migrates the previous single API setting into a named profile", async ({
  page,
}) => {
  await page.addInitScript(
    ({ completedTutorialKey, legacyApiKey }) => {
      localStorage.setItem(completedTutorialKey, "complete");
      sessionStorage.setItem(
        legacyApiKey,
        JSON.stringify({
          provider: "kimi",
          apiKey: "sk-kimi-legacy-e2e",
          modelId: "k3",
          reasoningEffort: "high",
        }),
      );
    },
    {
      completedTutorialKey: tutorialKey,
      legacyApiKey: "ai-agent-dashboard:model-config",
    },
  );
  await page.goto("/");

  const selector = page.getByLabel("API configuration for this conversation");
  await expect(selector.locator("option")).toHaveText(["Kimi"]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("ai-agent-dashboard:api-configs:v1"),
      ),
    )
    .toContain('"provider":"kimi"');
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("ai-agent-dashboard:model-config"),
      ),
    )
    .toBeNull();
});

test("creates a named desktop without a live Sandbox dependency", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");
  await page.getByRole("button", { name: "New desktop" }).click();
  const dialog = page.getByRole("dialog", { name: "Create desktop" });
  await dialog.getByLabel("Desktop name").fill("QA desktop");
  await dialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();
  await expect(page.getByText("QA desktop", { exact: true }).first()).toBeVisible();

  const notification = page.getByText("QA desktop created", { exact: true });
  await expect(notification).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(notification).toHaveCount(0);
});

test("increments the default name for each new desktop", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");

  await page.getByRole("button", { name: "New desktop" }).click();
  let dialog = page.getByRole("dialog", { name: "Create desktop" });
  await expect(dialog.getByLabel("Desktop name")).toHaveValue("Desktop 2");
  await dialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();
  await expect(page.getByText("Desktop 2", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "New desktop" }).click();
  dialog = page.getByRole("dialog", { name: "Create desktop" });
  await expect(dialog.getByLabel("Desktop name")).toHaveValue("Desktop 3");
});

test("edits and deletes conversations from hover actions without a selected check", async ({
  page,
}) => {
  await page.addInitScript(
    ({ completedTutorialKey, sessionsKey }) => {
      const now = Date.now();
      localStorage.setItem(completedTutorialKey, "complete");
      localStorage.setItem(
        sessionsKey,
        JSON.stringify([
          {
            id: "desktop-1",
            title: "Desktop 1",
            pinned: false,
            createdAt: now,
            updatedAt: now,
            sandboxId: null,
            generation: 0,
            runtimeEvents: [],
            activeConversationId: "conversation-1",
            conversations: [
              {
                id: "conversation-1",
                title: "First conversation",
                createdAt: now,
                updatedAt: now,
                revision: 0,
                messages: [],
                events: [],
                queuedPrompts: [],
              },
              {
                id: "conversation-2",
                title: "Second conversation",
                createdAt: now,
                updatedAt: now,
                revision: 0,
                messages: [],
                events: [],
                queuedPrompts: [],
              },
            ],
          },
        ]),
      );
    },
    {
      completedTutorialKey: tutorialKey,
      sessionsKey: "ai-agent-dashboard:sessions:v2",
    },
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Choose conversation" }).click();
  const firstOption = page.getByRole("option", {
    name: /First conversation/,
  });
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await expect(firstOption.locator("svg")).toHaveCount(0);
  await firstOption.hover();
  await page.getByRole("button", { name: "Edit First conversation" }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit conversation" });
  await editDialog.getByLabel("Conversation name").fill("Renamed conversation");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", { name: "Choose conversation" }),
  ).toContainText("Renamed conversation");

  await page.getByRole("button", { name: "Choose conversation" }).click();
  const renamedOption = page.getByRole("option", {
    name: /Renamed conversation/,
  });
  await renamedOption.hover();
  await page.getByRole("button", { name: "Delete Renamed conversation" }).click();
  const deleteDialog = page.getByRole("alertdialog", {
    name: "Delete conversation?",
  });
  await deleteDialog
    .getByRole("button", { name: "Delete conversation" })
    .click();

  await expect(
    page.getByRole("button", { name: "Choose conversation" }),
  ).toContainText("Second conversation");
});

test("clears all sessions only after the exact confirmation phrase", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");
  await page.getByRole("button", { name: "New desktop" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create desktop" });
  await createDialog.getByLabel("Desktop name").fill("Delete me");
  await createDialog
    .getByRole("button", { name: "Create desktop", exact: true })
    .click();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: /Data and storage/ }).click();
  await page.getByRole("button", { name: "Clear all data" }).click();

  const confirmation = page.getByRole("alertdialog", {
    name: "Delete all sessions and chats?",
  });
  const deleteButton = confirmation.getByRole("button", {
    name: "Delete everything",
  });
  await expect(deleteButton).toBeDisabled();
  await confirmation
    .getByLabel(/Type "Delete all sessions and chats"/)
    .fill("Delete all sessions and chat");
  await expect(deleteButton).toBeDisabled();
  await confirmation
    .getByLabel(/Type "Delete all sessions and chats"/)
    .fill("Delete all sessions and chats");
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  await expect(page.getByRole("heading", { name: "No desktops yet" })).toBeVisible();
  await expect(page.getByText("Delete me", { exact: true })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.length))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.length))
    .toBe(0);
});

test("runs VNC diagnostics without exposing infrastructure secrets", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "VNC Diagnostics" }).click();

  await expect(
    page.getByRole("heading", { name: "VNC Diagnostics" }),
  ).toBeVisible();
  await expect(page.getByText("Sandbox not allocated")).toBeVisible();
  await page.getByRole("button", { name: "Run diagnostics" }).click();
  await expect(page.getByText("Desktop is not allocated")).toBeVisible();
  await expect(page.getByText("Vercel authentication")).toBeVisible();
  await expect(page.getByText(/snap_[A-Za-z0-9]+/)).toHaveCount(0);
  await expect(page.getByText(/VERCEL_(?:OIDC_)?TOKEN=/)).toHaveCount(0);
});

test("manages multiple API configurations and selects one per conversation", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "complete"), tutorialKey);
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();

  await expect(page.getByText("BYOK deployment")).toHaveCount(0);
  await expect(page.getByText("Project Claude", { exact: true })).toHaveCount(0);

  const provider = page.getByLabel("Provider");
  await expect(provider).toHaveValue("anthropic-byok");
  await expect(provider.locator("option")).toHaveText([
    "Anthropic",
    "Kimi",
    "DeepSeek",
    "OpenAI-compatible",
  ]);

  await page.getByLabel("Configuration name").fill("Anthropic work");
  await page.locator("#byok-api-key").fill("sk-ant-e2e-browser-only");
  await page.getByLabel("Model ID").fill("claude-test-model");
  await page.getByRole("button", { name: "Add configuration" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("ai-agent-dashboard:api-configs:v1"),
      ),
    )
    .toContain('"provider":"anthropic-byok"');
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(localStorage)))
    .not.toContain("sk-ant-e2e-browser-only");

  await page.getByRole("button", { name: "Add config" }).click();
  await page.getByLabel("Configuration name").fill("DeepSeek fast");
  await provider.selectOption("deepseek");
  await page.locator("#byok-api-key").fill("sk-deepseek-e2e-only");
  await expect(page.getByLabel("Model ID")).toHaveValue("deepseek-v4-flash");
  await page.getByRole("button", { name: "Add configuration" }).click();

  await page.getByRole("button", { name: "Close settings" }).click();
  const configSelector = page.getByLabel(
    "API configuration for this conversation",
  );
  await expect(configSelector.locator("option")).toHaveText([
    "Anthropic work",
    "DeepSeek fast",
  ]);
  await configSelector.selectOption({ label: "DeepSeek fast" });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          sessionStorage.getItem("ai-agent-dashboard:api-configs:v1") ?? "{}",
        ).profiles ?? [];
        const selectedId = profiles.find(
          (profile: { id: string; name: string }) =>
            profile.name === "DeepSeek fast",
        )?.id;
        const sessions = JSON.parse(
          localStorage.getItem("ai-agent-dashboard:sessions:v2") ?? "[]",
        );
        return sessions[0]?.conversations[0]?.apiConfigId === selectedId;
      }),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Edit DeepSeek fast" }).click();
  await page.getByLabel("Configuration name").fill("DeepSeek primary");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Delete Anthropic work" }).click();
  await page.getByRole("button", { name: "Delete Anthropic work" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Anthropic work" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(configSelector.locator("option")).toHaveText([
    "DeepSeek primary",
  ]);

  const weatherPreset = page.getByRole("button", {
    name: "Use preset: What's the weather in Dubai?",
  });
  await expect(weatherPreset).toBeEnabled();
  await weatherPreset.click();
  await expect(page.locator("form input")).toHaveValue(
    "What's the weather in Dubai?",
  );
});
