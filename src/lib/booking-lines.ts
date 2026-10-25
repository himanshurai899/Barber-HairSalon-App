// Services inside a booking (design-plan section 8): load by ids, snapshot into booking_services, read back.
import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import * as s from "./db/schema";

export type Line = { name: string; durationMin: number; priceMinor: number };
type Service = typeof s.services.$inferSelect;

/** "Haircut + Beard trim" */
export const joinNames = (lines: { name: string }[]) => lines.map((l) => l.name).join(" + ");

/** Totals for a set of services: minutes and minor units. */
export const totals = (lines: { durationMin: number; priceMinor: number }[]) => ({
  durationMin: lines.reduce((n, l) => n + l.durationMin, 0),
  priceMinor: lines.reduce((n, l) => n + l.priceMinor, 0),
});

/** The requested services in shop order (sort, id), or null if any is unknown (or inactive, unless `activeOnly` is false). */
export async function loadBookableServices(db: Db, ids: number[], activeOnly = true): Promise<Service[] | null> {
  const rows = await db.select().from(s.services).where(inArray(s.services.id, ids)).orderBy(asc(s.services.sort), asc(s.services.id));
  return rows.length === ids.length && (!activeOnly || rows.every((r) => r.active)) ? rows : null;
}

/**
 * Inserts the booking and one snapshot line per service. `during` and the price come from the services.
 * The neon-http driver has no transactions, so a failed lines insert deletes the booking again.
 * A database error from the booking insert itself (the no_overlap rule) propagates untouched.
 */
export async function insertBooking(
  db: Db,
  b: Omit<typeof s.bookings.$inferInsert, "serviceId" | "during" | "priceMinor">,
  start: Date,
  svcs: Service[],
) {
  const t = totals(svcs);
  const [row] = await db
    .insert(s.bookings)
    .values({ ...b, serviceId: svcs[0].id, during: { start, end: new Date(start.getTime() + t.durationMin * 60_000) }, priceMinor: t.priceMinor })
    .returning({ token: s.bookings.manageToken, id: s.bookings.id });
  try {
    await db.insert(s.bookingServices).values(
      svcs.map((v, position) => ({ bookingId: row.id, serviceId: v.id, position, name: v.name, durationMin: v.durationMin, priceMinor: v.priceMinor })),
    );
  } catch (e) {
    await db.delete(s.bookings).where(eq(s.bookings.id, row.id));
    throw e;
  }
  return row;
}

/** Lines per booking id. Bookings without lines (written before booking_services) are left out: use `withServices`. */
export async function linesFor(db: Db, bookingIds: number[]) {
  const map = new Map<number, Line[]>();
  if (!bookingIds.length) return map;
  const rows = await db
    .select()
    .from(s.bookingServices)
    .where(inArray(s.bookingServices.bookingId, bookingIds))
    .orderBy(asc(s.bookingServices.bookingId), asc(s.bookingServices.position));
  for (const r of rows) map.set(r.bookingId, [...(map.get(r.bookingId) ?? []), { name: r.name, durationMin: r.durationMin, priceMinor: r.priceMinor }]);
  return map;
}

/** Adds `services` (all lines) to rows that carry id, service (primary name), priceMinor and during; `service` becomes the joined names. */
export async function withServices<T extends { id: number; service: string; priceMinor: number; during: { start: Date; end: Date } }>(db: Db, rows: T[]) {
  const map = await linesFor(db, rows.map((r) => r.id));
  return rows.map((r) => {
    const services: Line[] = map.get(r.id) ?? [
      { name: r.service, durationMin: Math.round((r.during.end.getTime() - r.during.start.getTime()) / 60_000), priceMinor: r.priceMinor },
    ];
    return { ...r, services, service: joinNames(services) };
  });
}
