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

test("hosted settings require BYOK through one provider dropdown", async ({
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
    "OpenAI-compatible",
  ]);

  await page
    .getByRole("textbox", { name: "API Key" })
    .fill("sk-ant-e2e-browser-only");
  await page.getByLabel("Model ID").fill("claude-test-model");
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("ai-agent-dashboard:model-config"),
      ),
    )
    .toContain('"provider":"anthropic-byok"');
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(localStorage)))
    .not.toContain("sk-ant-e2e-browser-only");

  await page.getByRole("button", { name: "Close settings" }).click();
  const weatherPreset = page.getByRole("button", {
    name: "Use preset: What's the weather in Dubai?",
  });
  await expect(weatherPreset).toBeEnabled();
  await weatherPreset.click();
  await expect(page.locator("form input")).toHaveValue(
    "What's the weather in Dubai?",
  );
});
