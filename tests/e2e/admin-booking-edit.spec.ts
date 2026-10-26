import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const main = (page: Page) => page.getByRole("main");

async function addBooking(page: Page, name: string, date: string, time: string) {
  await page.goto("/admin/bookings");
  const manual = page.locator("section").filter({ hasText: "Phone or walk-in booking" });
  await manual.getByLabel(/^Haircut \(/).check();
  await manual.getByLabel("Date").fill(date);
  await manual.getByLabel("Time").fill(time);
  await manual.getByLabel("Customer name").fill(name);
  await manual.getByLabel("Phone", { exact: true }).fill(`9${Math.floor(100000000 + Math.random() * 899999999)}`);
  await manual.getByRole("button", { name: "Add booking" }).click();
  await expect(manual.getByRole("status")).toContainText("Saved");
  await page.goto("/admin/bookings?status=approved");
}

test("admin reschedules a booking, adds a service and a note", async ({ page }) => {
  await signIn(page);
  const name = `Resched ${Date.now()}`;
  await addBooking(page, name, "2030-03-04", "10:00");
  await page.locator("li").filter({ hasText: name }).getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible();
  await main(page).getByLabel(/^Beard trim/).check();
  await main(page).getByLabel("Time").fill("11:30");
  await main(page).getByLabel("Note (optional)").fill("Prefers a short fade");
  await main(page).getByRole("button", { name: "Save" }).click();
  await expect(main(page).getByRole("status")).toContainText("Saved");
  await page.goto("/admin/bookings?status=approved");
  const row = page.locator("li").filter({ hasText: name });
  await expect(row).toContainText("Haircut + Beard trim");
  await expect(row).toContainText("11:30");
});

test("an edit onto a taken time is refused", async ({ page }) => {
  await signIn(page);
  const stamp = Date.now();
  await addBooking(page, `First ${stamp}`, "2030-03-06", "10:00");
  await addBooking(page, `Second ${stamp}`, "2030-03-06", "12:00");
  await page.locator("li").filter({ hasText: `Second ${stamp}` }).getByRole("link", { name: "Edit" }).click();
  await expect(main(page).getByLabel("Time")).toHaveValue("12:00");
  await main(page).getByLabel("Time").fill("10:00");
  await expect(main(page).getByLabel("Time")).toHaveValue("10:00");
  await main(page).getByRole("button", { name: "Save" }).click();
  await expect(main(page).locator("p[role=alert]")).toContainText("not available");
});

test("admin deletes a booking after confirming", async ({ page }) => {
  await signIn(page);
  const name = `Gone ${Date.now()}`;
  await addBooking(page, name, "2030-03-05", "10:00");
  await page.locator("li").filter({ hasText: name }).getByRole("link", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete booking?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(page.getByRole("status")).toContainText("Deleted");
  await page.goto("/admin/bookings?status=approved");
  await expect(page.getByText(name)).toHaveCount(0);
});
