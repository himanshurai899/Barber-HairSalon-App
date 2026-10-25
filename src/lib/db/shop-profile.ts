import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "./schema";

type Db = PgDatabase<PgQueryResultHKT, typeof s>;

// The salon's public facts (issue #8). Safe to commit: all of it is already public on Google.
// Barber phones, prices and offers are NOT here: enter them in /admin.
export const shopProfile = {
  name: "Krishna Hair Salon",
  tagline: "Where Style Meets Perfection",
  address: "Gf-11, Abhishek Complex, 30 mtr, Gotri Road, beside Narayan Garden Road, Laxmipura, Vadodara, Gujarat 390021",
  phone: "+919913407166",
  whatsappNumber: "+919913407166",
  pendingTtlMin: 24 * 60, // owner: request waits up to 1 day for approval
  minNoticeMin: 30,
  horizonDays: 30,
};

// 0 = Sunday
export const weeklyHours = [
  { weekday: 0, opens: "08:00", closes: "21:30" },
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "09:00", closes: "21:30" })),
  { weekday: 6, opens: "09:00", closes: "21:00" },
];

/** Idempotent: writes the shop profile and weekly hours. Safe to run in production. */
export async function applyShopProfile(db: Db) {
  await db.insert(s.shopSettings).values(shopProfile).onConflictDoUpdate({ target: s.shopSettings.id, set: shopProfile });
  for (const h of weeklyHours) {
    await db.insert(s.shopHours).values(h).onConflictDoUpdate({ target: s.shopHours.weekday, set: h });
  }
}
