import { expect, test } from "@playwright/test";

test("admin adds a service that shows on the public services page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/services");
  const add = page.locator("section").filter({ hasText: "Add a service" });
  const name = `Facial ${Date.now()}`;
  await add.getByLabel("Name").fill(name);
  await add.getByLabel("Duration (minutes)").fill("45");
  await add.getByLabel("Price (rupees)").fill("450");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(add.getByRole("status")).toContainText("Saved");
  await page.goto("/services");
  await expect(page.getByText(name)).toBeVisible();
});

test("admin dashboard shows the WhatsApp message log", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "WhatsApp messages" })).toBeVisible();
});
