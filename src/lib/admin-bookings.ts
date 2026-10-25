// Manual bookings, status override, notices and settings (design-plan sections 3 and 4).
import { eq } from "drizzle-orm";
import parsePhoneNumber from "libphonenumber-js";
import { z } from "zod";
import { AccessError, requireRole, type Actor } from "./access";
import { admin, check } from "./admin-service";
import type { Db } from "./db";
import * as s from "./db/schema";
import { shortDate } from "./format";
import { loadSettings } from "./shop";
import { zonedToUtc } from "./slots";

const taken = "That time is already booked for this barber.";
const isOverlap = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return (x.code ?? x.cause?.code) === "23P01";
};

/** Phone call or walk-in: a human already agreed, so it is approved directly. Overlap is still enforced by the database. */
export async function createManualBooking(
  db: Db,
  actor: Actor | null,
  input: unknown,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const a = requireRole(actor, ["admin", "barber"]);
  const d = check(
    z.object({
      serviceId: z.coerce.number().int().positive(),
      barberId: z.coerce.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
      time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
      name: z.string().trim().min(1, "Name is required").max(80),
      phone: z.string().trim().min(6, "Check the phone number").max(30),
      source: z.enum(["phone", "walk_in", "admin"]),
      note: z.string().trim().max(200).optional(),
    }),
    input,
  );
  if (a.role === "barber" && a.barberId !== d.barberId) throw new AccessError("forbidden");
  const phone = parsePhoneNumber(d.phone, "IN");
  if (!phone?.isValid()) return { ok: false, error: "Check the phone number." };
  const [service] = await db.select().from(s.services).where(eq(s.services.id, d.serviceId));
  if (!service) return { ok: false, error: "Unknown service." };
  const tz = (await loadSettings(db)).timezone;
  const start = zonedToUtc(d.date, d.time, tz);
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const [customer] = await db
    .insert(s.customers)
    .values({ phone: phone.number, name: d.name, waOptIn: false }) // no WhatsApp consent was given on the phone
    .onConflictDoUpdate({ target: s.customers.phone, set: { name: d.name } })
    .returning();
  try {
    const [row] = await db
      .insert(s.bookings)
      .values({
        customerId: customer.id,
        barberId: d.barberId,
        serviceId: service.id,
        during: { start, end },
        status: "approved",
        source: d.source,
        note: d.note || null,
        priceMinor: service.priceMinor,
        decidedBy: a.userId,
        decidedAt: new Date(),
      })
      .returning({ token: s.bookings.manageToken });
    return { ok: true, token: row.token };
  } catch (e) {
    if (isOverlap(e)) return { ok: false, error: taken };
    throw e;
  }
}

/** Admin escape hatch: set any status. Reviving a booking whose slot is gone fails on the overlap rule. */
export async function overrideStatus(db: Db, actor: Actor | null, bookingId: number, status: s.BookingStatus) {
  const a = requireRole(actor, ["admin"]);
  check(z.enum(s.bookingStatuses), status);
  try {
    await db
      .update(s.bookings)
      .set({ status, decidedBy: a.userId, decidedAt: new Date() })
      .where(eq(s.bookings.id, bookingId));
  } catch (e) {
    if (isOverlap(e)) return { ok: false as const, error: taken };
    throw e;
  }
  return { ok: true as const };
}

// --- Notices and offers ---
type NoticeText = { kind: "offer" | "notice"; title: string; body: string; badge: string | null; startsOn: string | null; endsOn: string | null };

/** Text formatted for pasting into a WhatsApp broadcast. */
export function copyForWhatsApp(n: NoticeText): string {
  const lines = [`${n.kind === "offer" ? "🎁" : "📢"} *${n.title}*`];
  if (n.body) lines.push(n.body);
  if (n.startsOn && n.endsOn) lines.push(`_${shortDate(n.startsOn)} to ${shortDate(n.endsOn)}_`);
  else if (n.endsOn) lines.push(`_Until ${shortDate(n.endsOn)}_`);
  else if (n.startsOn) lines.push(`_From ${shortDate(n.startsOn)}_`);
  return lines.join("\n");
}

const optDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().transform((v) => v || null);

export async function saveNotice(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z
      .object({
        id: z.coerce.number().int().positive().optional(),
        kind: z.enum(["offer", "notice"]),
        title: z.string().trim().min(1, "Title is required").max(120),
        body: z.string().trim().max(500).default(""),
        badge: z.string().trim().max(30).optional().transform((v) => v || null),
        startsOn: optDay,
        endsOn: optDay,
        active: z.boolean().default(true),
        sort: z.coerce.number().int().default(0),
      })
      .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: "End date is before the start date" }),
    input,
  );
  const { id, ...row } = d;
  if (id) await db.update(s.notices).set(row).where(eq(s.notices.id, id));
  else await db.insert(s.notices).values(row);
}

export async function deleteNotice(db: Db, actor: Actor | null, id: number) {
  admin(actor);
  await db.delete(s.notices).where(eq(s.notices.id, id));
}

// --- Settings ---
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const coord = (lo: number, hi: number) =>
  z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || (Number.isFinite(+v) && +v >= lo && +v <= hi), { message: "Not a valid coordinate" });
const mins = (max: number) => z.coerce.number().int().min(1).max(max);

export async function saveSettings(db: Db, actor: Actor | null, input: unknown) {
  admin(actor);
  const d = check(
    z.object({
      name: z.string().trim().min(1).max(80),
      tagline: z.string().trim().max(120).default(""),
      address: z.string().trim().min(1, "Address is required").max(200),
      lat: coord(-90, 90),
      lng: coord(-180, 180),
      mapsPlaceId: optText(120),
      phone: optText(30),
      whatsappNumber: optText(30),
      timezone: z.string().refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, { message: "Unknown timezone, like Asia/Kolkata" }),
      currency: z.string().trim().length(3, "Use a 3 letter currency code").toUpperCase(),
      greetingText: z.string().trim().min(1).max(600),
      pendingTtlMin: mins(10_080),
      slotStepMin: mins(240),
      minNoticeMin: z.coerce.number().int().min(0).max(10_080),
      horizonDays: mins(365),
      maxOpenPerPhone: mins(20),
    }),
    input,
  );
  await db.insert(s.shopSettings).values({ id: 1, ...d }).onConflictDoUpdate({ target: s.shopSettings.id, set: d });
}
