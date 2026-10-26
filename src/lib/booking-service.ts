// Customer-facing booking logic (design-plan sections 3, 8, 9, 11). Takes the db so tests can use PGlite.
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { insertBooking, loadBookableServices, withServices } from "./booking-lines";
import { transition } from "./bookings";
import { upsertClient } from "./clients";
import { normalizePhone } from "./phone";
import type { Db } from "./db";
import * as s from "./db/schema";
import { getSlots, pickBarber, zonedToUtc, type Slot, type SlotInput } from "./slots";
import { loadSettings } from "./shop";

const MIN = 60_000;
const open = ["pending", "approved"] as const;

/** Lazy expiry (no cron): runs before every read and insert. */
export async function expirePending(db: Db, ttlMin: number, now: Date) {
  await db
    .update(s.bookings)
    .set({ status: "expired" })
    .where(and(eq(s.bookings.status, "pending"), sql`${s.bookings.createdAt} < ${new Date(now.getTime() - ttlMin * MIN)}`));
}

const addDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 24 * 60 * MIN).toISOString().slice(0, 10);

/**
 * Loads everything getSlots needs for one shop-local date.
 * `staff` (admin edits): hidden services are allowed, no minimum notice, a ten year horizon,
 * and `excludeBookingId` is left out of the busy list so a booking can move around its own slot.
 */
export async function loadSlotInput(db: Db, date: string, serviceIds: number[], now: Date, staff?: { excludeBookingId: number }) {
  const settings = await loadSettings(db);
  await expirePending(db, settings.pendingTtlMin, now);
  const svcs = await loadBookableServices(db, serviceIds, !staff);
  if (!svcs) return null;
  const dayS = zonedToUtc(date, "00:00", settings.timezone).toISOString();
  const dayE = zonedToUtc(addDay(date), "00:00", settings.timezone).toISOString();
  const day = sql`tstzrange(${dayS}::timestamptz, ${dayE}::timestamptz)`;
  const [barbers, links, shopHours, specialHours, availability, timeOff, bookings] = await Promise.all([
    db.select().from(s.barbers).where(eq(s.barbers.active, true)),
    db.select().from(s.barberServices),
    db.select().from(s.shopHours),
    db.select().from(s.specialHours),
    db.select().from(s.availability),
    db.select().from(s.timeOff).where(sql`${s.timeOff.during} && ${day}`),
    db
      .select()
      .from(s.bookings)
      .where(and(inArray(s.bookings.status, [...open]), sql`${s.bookings.during} && ${day}`, staff ? ne(s.bookings.id, staff.excludeBookingId) : undefined)),
  ]);
  const slotInput: SlotInput = {
    date,
    services: svcs.map((v) => ({ id: v.id, durationMin: v.durationMin })),
    barbers: barbers.map((b) => ({
      id: b.id,
      sort: b.sort,
      active: b.active,
      serviceIds: links.filter((l) => l.barberId === b.id).map((l) => l.serviceId),
    })),
    shopHours,
    specialHours,
    availability,
    timeOff: timeOff.map((t) => ({ barberId: t.barberId, ...t.during })),
    bookings: bookings.map((b) => ({ barberId: b.barberId, ...b.during, status: b.status })),
    settings: {
      timezone: settings.timezone,
      slotStepMin: settings.slotStepMin,
      minNoticeMin: staff ? 0 : settings.minNoticeMin,
      horizonDays: staff ? 3650 : settings.horizonDays,
    },
    now,
  };
  return { slotInput, svcs };
}

export async function getAvailableSlots(
  db: Db,
  a: { serviceIds: number[]; date: string; now?: Date },
): Promise<Slot[]> {
  if (!a.serviceIds.length) return [];
  const loaded = await loadSlotInput(db, a.date, a.serviceIds, a.now ?? new Date());
  return loaded ? getSlots(loaded.slotInput) : [];
}

const input = z.object({
  serviceIds: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length), // no duplicates
  barber: z.union([z.literal("any"), z.coerce.number().int().positive()]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  waOptIn: z.boolean().default(true),
  website: z.string().max(0).default(""), // honeypot: humans leave it empty
  source: z.enum(s.bookingSources).default("web"),
});

export type BookingInput = z.input<typeof input>;
export type CreateResult =
  | { ok: true; token: string; id: number; created: boolean }
  | { ok: false; error: "invalid" | "unavailable" | "too_many"; message: string };

const fail = (error: "invalid" | "unavailable" | "too_many", message: string): CreateResult => ({ ok: false, error, message });

export async function createBooking(db: Db, raw: BookingInput, now = new Date()): Promise<CreateResult> {
  const parsed = input.safeParse(raw);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return fail("invalid", "Please check your name and phone number.");
  const d = parsed.data;

  const loaded = await loadSlotInput(db, d.date, d.serviceIds, now);
  if (!loaded) return fail("unavailable", "One of those services is not available.");
  const { slotInput: si, svcs } = loaded;
  const start = zonedToUtc(d.date, d.time, si.settings.timezone);

  // Customer by phone (the key); name follows their latest booking.
  const customer = await upsertClient(db, { phone, name: d.name, waOptIn: d.waOptIn });

  const mine = await db
    .select()
    .from(s.bookings)
    .where(and(eq(s.bookings.customerId, customer.id), inArray(s.bookings.status, [...open])));
  // Double submit: the same customer asking for the same start again gets the booking they already have.
  const same = mine.find((b) => b.during.start.getTime() === start.getTime());
  if (same) return { ok: true, token: same.manageToken, id: same.id, created: false };
  const settings = await loadSettings(db);
  if (mine.filter((b) => b.during.end > now).length >= settings.maxOpenPerPhone) {
    return fail("too_many", "You already have the maximum number of upcoming bookings. Please cancel one or call us.");
  }

  // The server decides what is bookable, not the client.
  const slot = getSlots(si).find((x) => x.start.getTime() === start.getTime());
  const candidates = d.barber === "any" ? slot?.barberIds : slot?.barberIds.filter((id) => id === d.barber);
  if (!slot || !candidates?.length) return fail("unavailable", "Sorry, that time was just taken. Please pick another.");
  const barberId =
    d.barber === "any"
      ? pickBarber({ barberIds: candidates, barbers: si.barbers, bookings: si.bookings, date: d.date, timezone: si.settings.timezone })
      : d.barber;

  try {
    const row = await insertBooking(db, { customerId: customer.id, barberId, status: "pending", source: d.source, createdAt: now }, start, svcs);
    return { ok: true, token: row.token, id: row.id, created: true };
  } catch (e) {
    // The database is the final referee: a concurrent request got there first.
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23P01") return fail("unavailable", "Sorry, that time was just taken. Please pick another.");
    throw e;
  }
}

export async function getBookingByToken(db: Db, token: string, now = new Date()) {
  const settings = await loadSettings(db);
  await expirePending(db, settings.pendingTtlMin, now);
  const [row] = await db
    .select({
      id: s.bookings.id,
      status: s.bookings.status,
      during: s.bookings.during,
      priceMinor: s.bookings.priceMinor,
      decisionNote: s.bookings.decisionNote,
      service: s.services.name, // primary; every service: withServices
      barber: s.barbers.name,
      customer: s.customers.name,
    })
    .from(s.bookings)
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.barbers, eq(s.barbers.id, s.bookings.barberId))
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(eq(s.bookings.manageToken, token));
  return row ? (await withServices(db, [row]))[0] : null;
}

export async function cancelBooking(
  db: Db,
  token: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_cancellable" }> {
  const b = await getBookingByToken(db, token, now);
  if (!b) return { ok: false, error: "not_found" };
  try {
    transition(b.status, "cancelled", "customer");
  } catch {
    return { ok: false, error: "not_cancellable" };
  }
  await db.update(s.bookings).set({ status: "cancelled" }).where(and(eq(s.bookings.id, b.id), eq(s.bookings.status, b.status)));
  return { ok: true };
}
