import { expect, test, type Page } from "@playwright/test";

const main = (page: Page) => page.getByRole("main");
const phone = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("admin adds, finds, edits and deletes a client; a duplicate number is refused", async ({ page }) => {
  await signIn(page);
  const stamp = Date.now();
  const name = `Client ${stamp}`;
  const number = phone();

  await page.goto("/admin/clients");
  const add = main(page).locator("section").filter({ hasText: "Add a client" });
  await expect(add.getByLabel("Name")).toBeVisible();
  await add.getByLabel("Name").fill(name);
  await add.getByLabel(/^Phone/).fill(number);
  await add.getByLabel("Notes (only you see these)").fill("Prefers the quiet chair");
  await add.getByRole("button", { name: "Add client" }).click();
  await expect(add.getByRole("status")).toContainText("Saved");

  // the same number, written another way, is refused with the existing name
  await add.getByLabel("Name").fill("Someone Else");
  await add.getByLabel(/^Phone/).fill(`0${number}`);
  await add.getByRole("button", { name: "Add client" }).click();
  await expect(add.locator("p[role=alert]")).toContainText(`A client with this number already exists: ${name}`);

  // search by phone and by name
  await page.goto(`/admin/clients?q=${number}`);
  await expect(main(page).getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await page.goto("/admin/clients?q=zzz-nobody");
  await expect(main(page).getByText("No clients found.")).toBeVisible();
  await page.goto(`/admin/clients?q=${stamp}`);
  await main(page).getByRole("link", { name: new RegExp(name) }).click();

  // detail: edit
  await expect(main(page).getByRole("heading", { name })).toBeVisible();
  await expect(main(page).getByLabel("Notes (only you see these)")).toHaveValue("Prefers the quiet chair");
  await main(page).getByLabel("Name").fill(`${name} Jr`);
  await main(page).getByLabel("Email (optional)").fill("kid@example.com");
  await main(page).getByRole("button", { name: "Save" }).click();
  await expect(main(page).getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(main(page).getByRole("heading", { name: `${name} Jr` })).toBeVisible();

  // delete, with a confirm step
  await main(page).getByRole("link", { name: "Delete client" }).click();
  await expect(main(page).getByRole("heading", { name: "Delete client?" })).toBeVisible();
  await main(page).getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(main(page).getByRole("status")).toContainText("Deleted");
  await page.goto(`/admin/clients?q=${stamp}`);
  await expect(main(page).getByText("No clients found.")).toBeVisible();
});

test("a client with bookings shows history, links to the booking, and cannot be deleted", async ({ page }) => {
  await signIn(page);
  const name = `Booked Client ${Date.now()}`;
  const number = phone();
  await page.goto("/admin/bookings");
  const manual = page.locator("section").filter({ hasText: "Phone or walk-in booking" });
  await manual.getByLabel(/^Haircut \(/).check();
  await manual.getByLabel("Date").fill("2030-04-01");
  await manual.getByLabel("Time").fill("10:00");
  await manual.getByLabel("Customer name").fill(name);
  await manual.getByLabel("Phone", { exact: true }).fill(number);
  await manual.getByRole("button", { name: "Add booking" }).click();
  await expect(manual.getByRole("status")).toContainText("Saved");

  // the same number typed another way reuses the client
  await manual.getByLabel(/^Haircut \(/).check();
  await manual.getByLabel("Date").fill("2030-04-02");
  await manual.getByLabel("Time").fill("10:00");
  await manual.getByLabel("Customer name").fill(name);
  await manual.getByLabel("Phone", { exact: true }).fill(`+91 ${number.slice(0, 5)} ${number.slice(5)}`);
  await manual.getByRole("button", { name: "Add booking" }).click();
  await expect(manual.getByRole("status")).toContainText("Saved");

  await page.goto(`/admin/clients?q=${number}`);
  await expect(main(page).getByRole("link", { name: /2 bookings/ })).toHaveCount(1);
  await main(page).getByRole("link", { name: /2 bookings/ }).click();
  await expect(main(page).getByRole("heading", { name: "Booking history" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: /Haircut with Hitesh/ })).toHaveCount(2);
  await main(page).getByRole("link", { name: /Haircut with Hitesh/ }).first().click();
  await expect(main(page).getByRole("heading", { name: "Edit booking" })).toBeVisible();

  await page.goBack();
  await main(page).getByRole("link", { name: "Delete client" }).click();
  await main(page).getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(main(page).locator("p[role=alert]")).toContainText("2 bookings");
});
