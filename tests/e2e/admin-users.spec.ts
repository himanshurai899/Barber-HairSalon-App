import { expect, test, type Page } from "@playwright/test";

const main = (page: Page) => page.getByRole("main");

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("admin creates, edits, resets and deletes a login; the user changes their own password", async ({ page }) => {
  const email = `tester${Date.now()}@demo.test`;
  await signIn(page, "admin@demo.test", "demo-password-1");
  await expect(page).toHaveURL(/\/admin$/);

  // create
  await page.goto("/admin/users");
  const create = main(page).locator("section").filter({ hasText: "New login" });
  await expect(create.getByLabel("Name")).toBeVisible();
  await create.getByLabel("Name").fill("Temp Tester");
  await create.getByLabel("Email").fill(email);
  await create.getByLabel("Temporary password").fill("start-pass-1");
  await create.getByRole("button", { name: "Create login" }).click();
  await expect(create.getByRole("status")).toContainText("Login created");

  // edit the name
  await page.goto("/admin/users");
  const row = main(page).locator("details").filter({ hasText: email });
  await row.locator("summary").click();
  await row.getByLabel("Name", { exact: true }).fill("Renamed Tester");
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row.getByRole("status").first()).toContainText("Saved");
  await page.reload();
  await expect(main(page).locator("details").filter({ hasText: email })).toContainText("Renamed Tester");

  // reset the password
  const again = main(page).locator("details").filter({ hasText: email });
  await again.locator("summary").click();
  await again.getByLabel(/^New password/).fill("reset-pass-22");
  await again.getByRole("button", { name: "Reset password" }).click();
  await expect(again.getByRole("status").last()).toContainText("Saved");

  // the old password no longer works, the reset one does, and the barber role keeps out of admin pages
  await signIn(page, email, "start-pass-1");
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
  await signIn(page, email, "reset-pass-22");
  await expect(page).toHaveURL(/\/staff$/);
  for (const path of ["/admin/users", "/admin/clients", "/admin/bookings/1/edit", "/admin/services/1/delete"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/staff$/);
  }

  // change own password
  await page.goto("/account/password");
  await main(page).getByLabel("Current password").fill("wrong-current");
  await main(page).getByLabel("New password (8 or more characters)").fill("final-pass-333");
  await main(page).getByLabel("New password again").fill("final-pass-333");
  await main(page).getByRole("button", { name: "Change password" }).click();
  await expect(main(page).locator("p[role=alert]")).toContainText("current password is not right");
  await main(page).getByLabel("Current password").fill("reset-pass-22");
  await main(page).getByLabel("New password (8 or more characters)").fill("final-pass-333");
  await main(page).getByLabel("New password again").fill("final-pass-333");
  await main(page).getByRole("button", { name: "Change password" }).click();
  await expect(main(page).getByRole("status")).toContainText("Password changed");
  await signIn(page, email, "final-pass-333");
  await expect(page).toHaveURL(/\/staff$/);

  // delete the login (admin, with a confirm step)
  await signIn(page, "admin@demo.test", "demo-password-1");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/users");
  const last = main(page).locator("details").filter({ hasText: email });
  await last.locator("summary").click();
  await last.getByRole("link", { name: "Delete login" }).click();
  await expect(main(page).getByRole("heading", { name: "Delete login?" })).toBeVisible();
  await main(page).getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect(main(page).getByRole("status")).toContainText("Deleted");
  await signIn(page, email, "final-pass-333");
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test("an admin cannot delete themselves or remove their own admin role", async ({ page }) => {
  await signIn(page, "admin@demo.test", "demo-password-1");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/users");
  const me = main(page).locator("details").filter({ hasText: "admin@demo.test" });
  await me.locator("summary").click();
  await expect(me.getByRole("link", { name: "Delete login" })).toHaveCount(0);
  await me.getByLabel("Role").selectOption("barber");
  await me.getByRole("button", { name: "Save", exact: true }).click();
  await expect(me.locator("p[role=alert]").first()).toContainText("yourself");
});
