import { expect, test } from "@playwright/test";

test("admin adds a phone booking and a notice appears on the landing page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/bookings");
  const name = `Caller ${Date.now()}`;
  const manual = page.locator("section").filter({ hasText: "Phone or walk-in booking" });
  await manual.getByLabel("Date").fill("2030-01-07");
  await manual.getByLabel("Time").fill("15:00");
  await manual.getByLabel("Customer name").fill(name);
  await manual.getByLabel("Phone", { exact: true }).fill(`9${Math.floor(100000000 + Math.random() * 899999999)}`);
  await manual.getByRole("button", { name: "Add booking" }).click();
  await expect(manual.getByRole("status")).toContainText("Saved");
  await page.goto("/admin/bookings?status=approved");
  await expect(page.getByText(name).first()).toBeVisible();

  await page.goto("/admin/notices");
  const title = `Closed for repairs ${Date.now()}`;
  const add = page.locator("section").filter({ hasText: "Add one" });
  await add.getByLabel("Title").fill(title);
  await add.getByRole("button", { name: "Add" }).click();
  await expect(add.getByRole("status")).toContainText("Saved");
  await page.goto("/");
  await expect(page.getByText(title)).toBeVisible();
});
