import { expect, test } from "@playwright/test";

// Demo staff exist only in the local PGlite database (src/lib/db/demo-staff.ts).
const PASSWORD = "demo-password-1";

test("customer books Hitesh, Hitesh approves, customer sees approved", async ({ page, browser }) => {
  const name = `Approval ${Date.now()}`;
  await page.goto("/book");
  await page.getByRole("link", { name: /^Haircut and beard/ }).click();
  await page.getByRole("link", { name: "Hitesh" }).click();
  await page.getByRole("list").filter({ has: page.getByRole("link", { name: /am|pm/ }) }).getByRole("link").last().click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Phone number").fill(`9${Math.floor(100000000 + Math.random() * 899999999)}`);
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(page.getByRole("status")).toContainText("pending");
  const customerUrl = page.url();

  // Hitesh signs in and approves it.
  const barber = await (await browser.newContext()).newPage();
  await barber.goto("/login");
  await barber.getByLabel("Email").fill("hitesh@demo.test");
  await barber.getByLabel("Password").fill(PASSWORD);
  await barber.getByRole("button", { name: "Sign in" }).click();
  const card = barber.getByRole("listitem").filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  // the request leaves the list and shows up in the schedule (no buttons there)
  await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(card).toHaveCount(1);

  // The other barber never sees it.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/login");
  await other.getByLabel("Email").fill("other@demo.test");
  await other.getByLabel("Password").fill(PASSWORD);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other.getByRole("heading", { name: "Requests" })).toBeVisible();
  await expect(other.getByText(name)).toHaveCount(0);

  await page.goto(customerUrl);
  await expect(page.getByRole("status")).toContainText("approved");
});
