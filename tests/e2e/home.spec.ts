import { expect, test } from "@playwright/test";

test("home page renders without horizontal scroll on a phone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("services page lists prices and the landing page has a book link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Book a slot" })).toBeVisible();
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Services", level: 1 })).toBeVisible();
  await expect(page.getByText("Haircut", { exact: true }).first()).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
});
