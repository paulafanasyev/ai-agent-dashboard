import { expect, test } from "@playwright/test";

const tutorialKey = "agent-desk-tutorial-v1-complete";

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
    .getByLabel(/Type Delete all sessions and chats/)
    .fill("Delete all sessions and chat");
  await expect(deleteButton).toBeDisabled();
  await confirmation
    .getByLabel(/Type Delete all sessions and chats/)
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
