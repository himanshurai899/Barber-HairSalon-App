import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "./schema";

// Demo data only: placeholder barbers, services and hours. Real shop details: shop-profile.ts, applied with `pnpm db:init-shop`.
export async function seed(db: PgDatabase<PgQueryResultHKT, typeof s>) {
  await db.insert(s.shopSettings).values({}).onConflictDoNothing();
  await db.insert(s.shopHours).values(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "10:00", closes: "20:00" })),
  ).onConflictDoNothing();
  await db.insert(s.specialHours).values({
    startsOn: "2026-10-11", endsOn: "2026-10-19", opens: "09:00", closes: "20:00", label: "Navratri special timings",
  });
  const barbers = await db.insert(s.barbers).values([
    { name: "Hitesh", instagram: "hitesh._hairartist", sort: 1 },
    { name: "Demo Barber", sort: 2 },
  ]).returning();
  const services = await db.insert(s.services).values([
    { name: "Haircut", category: "Hair", durationMin: 30, priceMinor: 20000, sort: 1 },
    { name: "Beard trim", category: "Beard", durationMin: 15, priceMinor: 10000, sort: 2 },
    { name: "Haircut and beard", category: "Hair", durationMin: 45, priceMinor: 28000, sort: 3 },
    { name: "Hair colour", category: "Colour", durationMin: 90, priceMinor: 120000, sort: 4 },
  ]).returning();
  await db.insert(s.barberServices).values(
    barbers.flatMap((b) => services.map((sv) => ({ barberId: b.id, serviceId: sv.id }))),
  );
  await db.insert(s.availability).values(
    barbers.flatMap((b) => [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      { barberId: b.id, weekday, startTime: "10:00", endTime: "13:30" },
      { barberId: b.id, weekday, startTime: "14:30", endTime: "20:00" }, // lunch break
    ])),
  );
  await db.insert(s.notices).values({
    kind: "offer", title: "Welcome offer", body: "10% off your first visit.", badge: "Offer",
  });
}
