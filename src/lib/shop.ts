// Read-side queries for the public pages.
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, type Db } from "./db";
import * as s from "./db/schema";
import { todayIn } from "./format";

export const getSettings = async () => loadSettings(await getDb());

export async function loadSettings(db: Db) {
  let [row] = await db.select().from(s.shopSettings);
  if (!row) {
    await db.insert(s.shopSettings).values({}).onConflictDoNothing();
    [row] = await db.select().from(s.shopSettings);
  }
  return row;
}

export async function getHours() {
  const db = await getDb();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const [weekly, special] = await Promise.all([
    db.select().from(s.shopHours).orderBy(asc(s.shopHours.weekday)),
    db.select().from(s.specialHours).where(gte(s.specialHours.endsOn, today)).orderBy(asc(s.specialHours.startsOn)),
  ]);
  return { weekly, special };
}

export async function getBarbers() {
  const db = await getDb();
  return db.select().from(s.barbers).where(eq(s.barbers.active, true)).orderBy(asc(s.barbers.sort), asc(s.barbers.id));
}

export async function getServices() {
  const db = await getDb();
  return db.select().from(s.services).where(eq(s.services.active, true)).orderBy(asc(s.services.sort), asc(s.services.id));
}

/** Notices and offers that are active today. */
export async function getNotices() {
  const db = await getDb();
  const today = todayIn((await getSettings()).timezone);
  return db
    .select()
    .from(s.notices)
    .where(
      and(
        eq(s.notices.active, true),
        or(isNull(s.notices.startsOn), lte(s.notices.startsOn, today)),
        or(isNull(s.notices.endsOn), gte(s.notices.endsOn, today)),
      ),
    )
    .orderBy(asc(s.notices.sort), asc(s.notices.id));
}

/** Barber time off that ends in the future, for the automatic "X unavailable" notice. */
export async function getUpcomingTimeOff(horizonDays = 14) {
  const db = await getDb();
  return db
    .select({ barber: s.barbers.name, during: s.timeOff.during })
    .from(s.timeOff)
    .innerJoin(s.barbers, eq(s.barbers.id, s.timeOff.barberId))
    .where(and(eq(s.barbers.active, true), sql`upper(${s.timeOff.during}) > now() and lower(${s.timeOff.during}) < now() + ${`${horizonDays} days`}::interval`))
    .orderBy(sql`lower(${s.timeOff.during})`);
}

export async function getBarbersForService(serviceId: number) {
  const db = await getDb();
  return db
    .select({ id: s.barbers.id, name: s.barbers.name })
    .from(s.barbers)
    .innerJoin(s.barberServices, eq(s.barberServices.barberId, s.barbers.id))
    .where(and(eq(s.barbers.active, true), eq(s.barberServices.serviceId, serviceId)))
    .orderBy(asc(s.barbers.sort), asc(s.barbers.id));
}
