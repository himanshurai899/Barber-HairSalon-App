// Barber/admin booking decisions and schedule. Every function checks the actor itself.
import { and, eq } from "drizzle-orm";
import { AccessError, getBookingFor, listBookingsFor, requireRole, type Actor } from "./access";
import { expirePending } from "./booking-service";
import { transition } from "./bookings";
import type { Db } from "./db";
import * as s from "./db/schema";
import { loadSettings } from "./shop";
import { zonedToUtc } from "./slots";

/** Approve or reject a pending request. Throws on anything the lifecycle does not allow. */
export async function decideBooking(
  db: Db,
  actor: Actor | null,
  bookingId: number,
  decision: "approved" | "rejected",
  note?: string,
  now = new Date(),
) {
  const a = requireRole(actor, ["admin", "barber"]);
  await expirePending(db, (await loadSettings(db)).pendingTtlMin, now);
  const b = await getBookingFor(db, a, bookingId);
  if (!b) throw new AccessError("forbidden"); // missing and someone else's look the same
  transition(b.status, decision, a.role);
  await db
    .update(s.bookings)
    .set({ status: decision, decidedBy: a.userId, decidedAt: now, decisionNote: note?.trim() || null })
    // guard against a concurrent decision
    .where(and(eq(s.bookings.id, b.id), eq(s.bookings.status, b.status)));
}

/** Approved bookings from the start of today (shop time) onwards, soonest first. */
export async function getSchedule(db: Db, actor: Actor | null, now = new Date()) {
  const a = requireRole(actor, ["admin", "barber"]);
  const tz = (await loadSettings(db)).timezone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const from = zonedToUtc(today, "00:00", tz);
  return (await listBookingsFor(db, a, ["approved"]))
    .filter((b) => b.during.end > from)
    .sort((x, y) => x.during.start.getTime() - y.during.start.getTime());
}
