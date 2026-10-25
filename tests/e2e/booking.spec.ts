import { expect, test } from "@playwright/test";

// The local e2e database is shared by the whole run, so each run uses its own phone number.
const phone = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

async function startBooking(page: import("@playwright/test").Page, name: string) {
  await page.goto("/book");
  await page.getByRole("link", { name: /^Beard trim/ }).click();
  await page.getByRole("link", { name: "Any available" }).click();
  await page.getByRole("list").filter({ has: page.getByRole("link", { name: /am|pm/ }) }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "4. Your details" })).toBeVisible();
  await page.getByLabel("Your name").fill(name);
}

test("customer books a slot, sees it pending, and cancels", async ({ page }) => {
  await startBooking(page, "E2E Customer");
  await page.getByLabel("Phone number").fill(phone());
  await page.getByRole("button", { name: "Request booking" }).click();

  await expect(page).toHaveURL(/\/b\/[0-9a-f]{32}$/);
  await expect(page.getByRole("status")).toContainText("pending");
  await expect(page.getByText("Beard trim").first()).toBeVisible();

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByRole("status")).toContainText("cancelled");
  await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
});

test("an invalid phone number shows an error and keeps what was typed", async ({ page }) => {
  await startBooking(page, "Typo Tina");
  await page.getByLabel("Phone number").fill("123");
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Typo Tina");
});
