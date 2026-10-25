import { expect, test } from "vitest";
import { createLocalDb } from "./local-db";
import { shopHours, shopSettings } from "./schema";
import { applyShopProfile } from "./shop-profile";

test("applyShopProfile writes the salon's hours and settings, and is idempotent", async () => {
  const db = await createLocalDb();
  await applyShopProfile(db);
  await applyShopProfile(db);
  const hours = await db.select().from(shopHours);
  expect(hours).toHaveLength(7);
  expect(hours.find((h) => h.weekday === 0)).toMatchObject({ opens: "08:00:00", closes: "21:30:00" });
  expect(hours.find((h) => h.weekday === 6)?.closes).toBe("21:00:00");
  const [settings] = await db.select().from(shopSettings);
  expect(settings).toMatchObject({ pendingTtlMin: 1440, minNoticeMin: 30, horizonDays: 30, phone: "+919913407166" });
});
