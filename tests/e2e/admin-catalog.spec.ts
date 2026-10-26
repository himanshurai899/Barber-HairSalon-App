import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function addService(page: Page, name: string) {
  await page.goto("/admin/services");
  const add = page.locator("section").filter({ hasText: "Add a service" });
  await add.getByLabel("Name").fill(name);
  await add.getByLabel("Duration (minutes)").fill("20");
  await add.getByLabel("Price (rupees)").fill("100");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(add.getByRole("status")).toContainText("Saved");
}

async function openDelete(page: Page, name: string) {
  await page.goto("/admin/services");
  const row = page.locator("details").filter({ hasText: name }).first();
  await row.locator("summary").click();
  await row.getByRole("link", { name: "Delete service" }).click();
}

test("deleting an unused service asks for confirmation and removes it", async ({ page }) => {
  await signIn(page);
  const name = `Unused ${Date.now()}`;
  await addService(page, name);
  await openDelete(page, name);
  await expect(page.getByRole("heading", { name: "Delete service?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(page.getByRole("status")).toContainText("Deleted");
  await page.goto("/admin/services");
  await expect(page.getByText(name)).toHaveCount(0);
});

test("a service with bookings cannot be deleted", async ({ page }) => {
  await signIn(page);
  const name = `Booked ${Date.now()}`;
  await addService(page, name);
  await page.goto("/admin/bookings");
  const manual = page.locator("section").filter({ hasText: "Phone or walk-in booking" });
  await manual.getByLabel(new RegExp(`^${name}`)).check();
  await manual.getByLabel("Date").fill("2030-02-04");
  await manual.getByLabel("Time").fill("11:00");
  await manual.getByLabel("Customer name").fill("Catalog Tester");
  await manual.getByLabel("Phone", { exact: true }).fill(`9${Math.floor(100000000 + Math.random() * 899999999)}`);
  await manual.getByRole("button", { name: "Add booking" }).click();
  await expect(manual.getByRole("status")).toContainText("Saved");
  await openDelete(page, name);
  await page.getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("deactivate");
  await page.goto("/admin/services");
  await expect(page.getByText(name)).toBeVisible();
});

test("special hours can be edited", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/hours");
  const row = page.locator("li").filter({ hasText: "Navratri special timings" });
  await row.locator("summary").click();
  await row.getByLabel("Label").fill("Edited festival hours");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByText("Edited festival hours")).toBeVisible();
});
