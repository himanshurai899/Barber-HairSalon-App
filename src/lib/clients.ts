// Clients (the customers table) as the admin sees them: list, detail, create, edit, delete.
// customers.phone is unique and always E.164, so one number is one client however it was typed.
import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireRole, type Actor } from "./access";
import { admin, check } from "./admin-service";
import { withServices } from "./booking-lines";
import type { Db } from "./db";
import * as s from "./db/schema";
import { normalizePhone } from "./phone";

/** Insert-or-update by normalised phone: the name follows the latest booking. `waOptIn` is only touched when given. */
export async function upsertClient(db: Db, c: { phone: string; name: string; waOptIn?: boolean }) {
  const [row] = await db
    .insert(s.customers)
    .values({ phone: c.phone, name: c.name, waOptIn: c.waOptIn ?? false })
    .onConflictDoUpdate({ target: s.customers.phone, set: c.waOptIn === undefined ? { name: c.name } : { name: c.name, waOptIn: c.waOptIn } })
    .returning();
  return row;
}

const isUnique = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return (x.code ?? x.cause?.code) === "23505";
};
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const exists = (name: string) => ({ ok: false as const, error: `A client with this number already exists: ${name}` });

export async function saveClient(db: Db, actor: Actor | null, input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  admin(actor);
  const d = check(
    z.object({
      id: z.coerce.number().int().positive().optional(),
      name: z.string().trim().min(1, "Name is required").max(80),
      phone: z.string().trim().min(1, "Phone is required").max(30),
      email: z.string().trim().email("Check the email address").or(z.literal("")).optional().transform((v) => v || null),
      notes: optional(1000),
      waOptIn: z.boolean().default(false),
    }),
    input,
  );
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: "Check the phone number." };
  const [other] = await db.select().from(s.customers).where(eq(s.customers.phone, phone));
  if (other && other.id !== d.id) return exists(other.name);
  const { id, phone: _raw, ...rest } = d;
  void _raw;
  try {
    if (id) {
      const done = await db.update(s.customers).set({ ...rest, phone }).where(eq(s.customers.id, id)).returning({ id: s.customers.id });
      return done.length ? { ok: true, id } : { ok: false, error: "Client not found." };
    }
    const [row] = await db.insert(s.customers).values({ ...rest, phone }).returning({ id: s.customers.id });
    return { ok: true, id: row.id };
  } catch (e) {
    if (!isUnique(e)) throw e;
    const [now] = await db.select().from(s.customers).where(eq(s.customers.phone, phone)); // lost a race with another request
    return exists(now?.name ?? "someone");
  }
}

/** Blocked while the client has bookings (history is kept); otherwise removed. */
export async function deleteClient(db: Db, actor: Actor | null, id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  admin(actor);
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
  if (!c) return { ok: false, error: "Client not found." };
  const [{ n }] = await db.select({ n: count() }).from(s.bookings).where(eq(s.bookings.customerId, id));
  if (n) return { ok: false, error: `"${c.name}" has ${n} booking${n === 1 ? "" : "s"}, so the client cannot be deleted.` };
  await db.delete(s.customers).where(eq(s.customers.id, id));
  return { ok: true };
}

type Visit = { customerId: number; start: Date; status: s.BookingStatus; priceMinor: number };
const summarize = (visits: Visit[]) => {
  const starts = visits.map((v) => v.start.getTime());
  return {
    bookingCount: visits.length,
    firstVisit: starts.length ? new Date(Math.min(...starts)) : null,
    lastVisit: starts.length ? new Date(Math.max(...starts)) : null,
    approvedTotalMinor: visits.filter((v) => v.status === "approved").reduce((n, v) => n + v.priceMinor, 0),
  };
};

/** Clients matching `q` (name part, or phone in any spelling), most recent visit first, never-visited last. */
export async function listClients(db: Db, actor: Actor | null, q = "") {
  requireRole(actor, ["admin"]);
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const exact = normalizePhone(term);
  const match = term
    ? or(ilike(s.customers.name, `%${term}%`), exact ? eq(s.customers.phone, exact) : undefined, digits.length >= 3 ? ilike(s.customers.phone, `%${digits}%`) : undefined)
    : undefined;
  const [clients, bookings] = await Promise.all([
    db.select().from(s.customers).where(match).orderBy(asc(s.customers.name)),
    db.select({ customerId: s.bookings.customerId, during: s.bookings.during, status: s.bookings.status, priceMinor: s.bookings.priceMinor }).from(s.bookings),
  ]);
  const rows = clients.map((c) => ({ ...c, ...summarize(bookings.filter((b) => b.customerId === c.id).map((b) => ({ ...b, start: b.during.start }))) }));
  return rows.sort((a, b) => (b.lastVisit?.getTime() ?? -Infinity) - (a.lastVisit?.getTime() ?? -Infinity) || b.createdAt.getTime() - a.createdAt.getTime());
}

/** One client with stats and full booking history (newest first), or null. */
export async function getClient(db: Db, actor: Actor | null, id: number) {
  requireRole(actor, ["admin"]);
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
  if (!c) return null;
  const rows = await db
    .select({
      id: s.bookings.id,
      status: s.bookings.status,
      during: s.bookings.during,
      priceMinor: s.bookings.priceMinor,
      barber: s.barbers.name,
      service: s.services.name,
    })
    .from(s.bookings)
    .innerJoin(s.barbers, eq(s.barbers.id, s.bookings.barberId))
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .where(eq(s.bookings.customerId, id))
    .orderBy(desc(s.bookings.id));
  const history = (await withServices(db, rows)).sort((a, b) => b.during.start.getTime() - a.during.start.getTime());
  return { ...c, ...summarize(history.map((h) => ({ customerId: id, start: h.during.start, status: h.status, priceMinor: h.priceMinor }))), history };
}
