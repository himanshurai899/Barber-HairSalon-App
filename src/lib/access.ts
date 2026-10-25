// Role checks and per-barber data scoping (design-plan sections 2 and 11).
// Every server action calls requireRole itself; layouts are only a convenience.
import { and, asc, eq, type SQL } from "drizzle-orm";
import { withServices } from "./booking-lines";
import type { Db } from "./db";
import * as s from "./db/schema";

export type Role = "admin" | "barber";
export type Actor = { userId: string; role: Role; barberId: number | null };

export class AccessError extends Error {
  constructor(readonly code: "unauthenticated" | "forbidden") {
    super(code);
  }
}

export function requireRole(actor: Actor | null | undefined, roles: Role[]): Actor {
  if (!actor) throw new AccessError("unauthenticated");
  if (!roles.includes(actor.role)) throw new AccessError("forbidden");
  return actor;
}

const columns = {
  id: s.bookings.id,
  status: s.bookings.status,
  source: s.bookings.source,
  during: s.bookings.during,
  priceMinor: s.bookings.priceMinor,
  note: s.bookings.note,
  createdAt: s.bookings.createdAt,
  barberId: s.bookings.barberId,
  barber: s.barbers.name,
  service: s.services.name, // primary; the rows returned carry every service (withServices)
  customer: s.customers.name,
  customerPhone: s.customers.phone,
};

function visibleBookings(db: Db, actor: Actor, extra?: SQL) {
  const own = actor.role === "admin" ? undefined : eq(s.bookings.barberId, actor.barberId ?? -1);
  return db
    .select(columns)
    .from(s.bookings)
    .innerJoin(s.barbers, eq(s.barbers.id, s.bookings.barberId))
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(and(own, extra));
}

/** Barbers see their own bookings, admins see all. Oldest booking first. */
export async function listBookingsFor(db: Db, actor: Actor | null, statuses?: s.BookingStatus[]) {
  const a = requireRole(actor, ["admin", "barber"]);
  const rows = await visibleBookings(db, a).orderBy(asc(s.bookings.createdAt), asc(s.bookings.id));
  return withServices(db, statuses ? rows.filter((r) => statuses.includes(r.status)) : rows);
}

/** One booking, or null when it does not exist or belongs to another barber. */
export async function getBookingFor(db: Db, actor: Actor | null, id: number) {
  const a = requireRole(actor, ["admin", "barber"]);
  const [row] = await visibleBookings(db, a, eq(s.bookings.id, id));
  return row ? (await withServices(db, [row]))[0] : null;
}
