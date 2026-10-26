// Admin catalog changes (design-plan section 4). Every function checks the actor and validates with Zod first.
import { count, eq, or } from "drizzle-orm";
import { z } from "zod";
import { requireRole, type Actor } from "./access";
import type { Db } from "./db";
import * as s from "./db/schema";
import { normalizePhone } from "./phone";
import { loadSettings } from "./shop";
import { zonedToUtc } from "./slots";

/** First readable message of a failed parse. */
export function check<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message);
  }
  return r.data;
}

export const admin = (actor: Actor | null) => requireRole(actor, ["admin"]);
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const flag = z.boolean().default(true);
const intSort = z.coerce.number().int().min(-1000).max(1000).default(0);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use times like 10:00");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

/** "10:00-13:30, 14:30-20:00" to windows. Blank means closed. Throws on bad, backwards or overlapping windows. */
export function parseWindows(input: string): { start: string; end: string }[] {
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  const windows = parts.map((p) => {
    const m = p.match(/^(\S+)\s*-\s*(\S+)$/);
    if (!m) throw new Error(`"${p}": use times like 10:00-13:30`);
    const [start, end] = [check(hhmm, m[1]), check(hhmm, m[2])];
    if (end <= start) throw new Error(`"${p}": closing time must be after opening time`);
    return { start, end };
  });
  const sorted = [...windows].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) throw new Error("Windows in one day overlap");
  }
  return windows;
}

const id = z.coerce.number().int().positive().optional();

export async function saveService(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z.object({
      id,
      name: z.string().trim().min(1, "Name is required").max(80),
      category: z.string().trim().max(40).optional().transform((v) => v || "Hair"),
      durationMin: z.coerce.number().int().min(1, "Duration must be at least 1 minute").max(480),
      price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
      sort: intSort,
      active: flag,
    }),
    input,
  );
  const row = { name: d.name, category: d.category, durationMin: d.durationMin, priceMinor: Math.round(d.price * 100), sort: d.sort, active: d.active };
  if (d.id) await db.update(s.services).set(row).where(eq(s.services.id, d.id));
  else await db.insert(s.services).values(row);
}

export async function saveBarber(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z.object({
      id,
      name: z.string().trim().min(1, "Name is required").max(80),
      phone: text(30),
      photoUrl: z.string().trim().url("Photo must be a link").or(z.literal("")).optional().transform((v) => v || null),
      bio: text(300),
      instagram: z.string().trim().max(60).optional().transform((v) => v?.replace(/^@/, "") || null),
      sort: intSort,
      active: flag,
      serviceIds: z.array(z.coerce.number().int().positive()).default([]),
    }),
    input,
  );
  const { id: barberId, serviceIds, ...rest } = d;
  let phone: string | null = null;
  if (rest.phone) {
    phone = normalizePhone(rest.phone);
    if (!phone) throw new Error("phone: Check the phone number");
    const [other] = await db.select().from(s.barbers).where(eq(s.barbers.phone, phone));
    if (other && other.id !== barberId) throw new Error(`phone: That number is already used by ${other.name}`);
  }
  const row = { ...rest, phone };
  const saved = barberId
    ? (await db.update(s.barbers).set(row).where(eq(s.barbers.id, barberId)).returning({ id: s.barbers.id }))[0]
    : (await db.insert(s.barbers).values(row).returning({ id: s.barbers.id }))[0];
  await db.delete(s.barberServices).where(eq(s.barberServices.barberId, saved.id));
  if (serviceIds.length) await db.insert(s.barberServices).values(serviceIds.map((serviceId) => ({ barberId: saved.id, serviceId })));
}

/** lines: weekday (0 = Sunday) to "10:00-20:00"; blank or missing = closed. */
export async function saveShopHours(db: Db, actor: Actor | null, lines: Record<string, string>) {
  admin(actor);
  const rows = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => {
    const w = parseWindows(lines[weekday] ?? "");
    if (w.length > 1) throw new Error("Shop hours: one window per day, like 10:00-20:00");
    return w.map((x) => ({ weekday, opens: x.start, closes: x.end }));
  });
  await db.delete(s.shopHours);
  if (rows.length) await db.insert(s.shopHours).values(rows);
}

export async function addSpecialHours(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z
      .object({
        id,
        startsOn: day,
        endsOn: day,
        opens: hhmm.optional(),
        closes: hhmm.optional(),
        closed: z.boolean().default(false),
        label: z.string().trim().max(80).default(""),
      })
      .refine((v) => v.endsOn >= v.startsOn, { message: "End date is before the start date" })
      .refine((v) => v.closed || (v.opens && v.closes && v.closes > v.opens), { message: "Set opening and closing times, closing after opening" }),
    input,
  );
  const row = {
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    opens: d.closed ? null : d.opens,
    closes: d.closed ? null : d.closes,
    closed: d.closed,
    label: d.label,
  };
  if (d.id) await db.update(s.specialHours).set(row).where(eq(s.specialHours.id, d.id));
  else await db.insert(s.specialHours).values(row);
}

export async function deleteSpecialHours(db: Db, actor: Actor | null, specialId: number) {
  admin(actor);
  await db.delete(s.specialHours).where(eq(s.specialHours.id, specialId));
}

/** lines: weekday to "10:00-13:30, 14:30-20:00". Replaces all of the barber's windows. */
export async function saveAvailability(db: Db, actor: Actor | null, barberId: number, lines: Record<string, string>) {
  admin(actor);
  const rows = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) =>
    parseWindows(lines[weekday] ?? "").map((w) => ({ barberId, weekday, startTime: w.start, endTime: w.end })),
  );
  await db.delete(s.availability).where(eq(s.availability.barberId, barberId));
  if (rows.length) await db.insert(s.availability).values(rows);
}

/** Whole days off, from the first date to the last date inclusive (shop time). */
export async function addTimeOff(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z.object({ id, barberId: z.coerce.number().int().positive(), from: day, to: day, reason: text(120) }).refine((v) => v.to >= v.from, {
      message: "Last day is before the first day",
    }),
    input,
  );
  const tz = (await loadSettings(db)).timezone;
  const next = new Date(Date.parse(`${d.to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const row = {
    barberId: d.barberId,
    during: { start: zonedToUtc(d.from, "00:00", tz), end: zonedToUtc(next, "00:00", tz) },
    reason: d.reason,
  };
  if (d.id) await db.update(s.timeOff).set(row).where(eq(s.timeOff.id, d.id));
  else await db.insert(s.timeOff).values(row);
}

export async function deleteTimeOff(db: Db, actor: Actor | null, timeOffId: number) {
  admin(actor);
  await db.delete(s.timeOff).where(eq(s.timeOff.id, timeOffId));
}

const bookingsText = (name: string, n: number) => `"${name}" has ${n} booking${n === 1 ? "" : "s"}, deactivate it instead.`;

/** Hard delete. Blocked while any booking (or booking line) references the service; otherwise barber links go with it. */
export async function deleteService(db: Db, actor: Actor | null, serviceId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  admin(actor);
  const [svc] = await db.select().from(s.services).where(eq(s.services.id, serviceId));
  if (!svc) return { ok: false, error: "Service not found." };
  const [{ n }] = await db
    .select({ n: count() })
    .from(s.bookings)
    .leftJoin(s.bookingServices, eq(s.bookingServices.bookingId, s.bookings.id))
    .where(or(eq(s.bookings.serviceId, serviceId), eq(s.bookingServices.serviceId, serviceId)));
  if (n) return { ok: false, error: bookingsText(svc.name, n) };
  await db.delete(s.services).where(eq(s.services.id, serviceId)); // barber_services cascades
  return { ok: true };
}

/** Hard delete. Blocked while bookings reference the barber; availability, links and time off go with it. */
export async function deleteBarber(db: Db, actor: Actor | null, barberId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  admin(actor);
  const [b] = await db.select().from(s.barbers).where(eq(s.barbers.id, barberId));
  if (!b) return { ok: false, error: "Barber not found." };
  const [{ n }] = await db.select({ n: count() }).from(s.bookings).where(eq(s.bookings.barberId, barberId));
  if (n) return { ok: false, error: bookingsText(b.name, n) };
  await db.delete(s.barbers).where(eq(s.barbers.id, barberId));
  return { ok: true };
}
