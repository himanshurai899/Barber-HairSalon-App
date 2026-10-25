import { expect, test, type Page } from "@playwright/test";

// Demo staff exist only in the local PGlite database (src/lib/db/demo-staff.ts).
const PASSWORD = "demo-password-1";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("anonymous visitors are sent to the login page", async ({ page }) => {
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("hitesh@demo.test");
  await page.getByLabel("Password").fill("nope-nope-nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test("a barber lands on /staff and cannot open /admin", async ({ page }) => {
  await signIn(page, "hitesh@demo.test");
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff$/);
});

test("admin creates a barber login that can sign in", async ({ page, browser }) => {
  const email = `new-${Date.now()}@demo.test`;
  await signIn(page, "admin@demo.test");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/users");
  await page.getByLabel("Name").fill("New Barber");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Temporary password").fill("temp-password-1");
  await page.getByRole("button", { name: "Create login" }).click();
  await expect(page.getByRole("status")).toContainText("Login created");

  const other = await (await browser.newContext()).newPage();
  await other.goto("/login");
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("temp-password-1");
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/staff$/);
});
