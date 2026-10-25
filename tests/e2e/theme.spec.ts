import { expect, test } from "@playwright/test";

test("theme toggle cycles auto, light, dark and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await expect(html).not.toHaveAttribute("data-theme", /.+/); // auto follows the device (dark here)
  expect(await bg()).toBe("rgb(22, 22, 20)");

  await toggle.click(); // light
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await bg()).toBe("rgb(250, 248, 245)");

  await page.reload(); // saved before first paint
  await expect(html).toHaveAttribute("data-theme", "light");

  await toggle.click(); // dark
  await expect(html).toHaveAttribute("data-theme", "dark");
  await toggle.click(); // back to auto
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
});
