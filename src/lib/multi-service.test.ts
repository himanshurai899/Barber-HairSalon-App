import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "./access";
import { getBookingFor, listBookingsFor } from "./access";
import { createManualBooking } from "./admin-bookings";
import { createBooking, getAvailableSlots, getBookingByToken } from "./booking-service";
import { barberServices, barbers, bookings, bookingServices, services, user } from "./db/schema";
import { createLocalDb } from "./db/local-db";
import { seed } from "./db/seed";
import { notifyDecision, notifyNewRequest } from "./notify";

// Seed services: 1 Haircut 30 min 20000, 2 Beard trim 15 min 10000, 3 Haircut and beard 45 min 28000, 4 Hair colour 90 min 120000.
// 2026-11-02 is a Monday, shop open 10:00-13:30 and 14:30-20:00 IST; "now" is the Sunday before.
type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const now = new Date("2026-11-01T06:00:00Z");
const base = { serviceIds: [1, 2], barber: 1 as number | "any", date: "2026-11-02", time: "10:00", name: "Asha", phone: "98250 11111" };
const admin: Actor = { userId: "a", role: "admin", barberId: null };

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
  await db.insert(user).values({ id: "a", name: "Admin", email: "a@example.test", role: "admin" });
});

describe("several services in one booking", () => {
  test("creates one booking with summed duration and price, first service as primary, and a line per service", async () => {
    const r = await createBooking(db, base, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [b] = await db.select().from(bookings);
    expect(b.serviceId).toBe(1);
    expect(b.priceMinor).toBe(30000);
    expect(b.during.start.toISOString()).toBe("2026-11-02T04:30:00.000Z");
    expect(b.during.end.toISOString()).toBe("2026-11-02T05:15:00.000Z");
    const lines = await db.select().from(bookingServices).orderBy(bookingServices.position);
    expect(lines.map((l) => [l.bookingId, l.serviceId, l.name, l.durationMin, l.priceMinor])).toEqual([
      [b.id, 1, "Haircut", 30, 20000],
      [b.id, 2, "Beard trim", 15, 10000],
    ]);
    const got = await getBookingByToken(db, r.token, now);
    expect(got?.services.map((x) => x.name)).toEqual(["Haircut", "Beard trim"]);
    expect(got?.service).toBe("Haircut + Beard trim");
    expect(got?.priceMinor).toBe(30000);
  });

  test("the order the customer ticks does not matter; the shop's service order wins", async () => {
    await createBooking(db, { ...base, serviceIds: [2, 1] }, now);
    expect((await db.select().from(bookings))[0].serviceId).toBe(1);
  });

  test("availability uses the summed duration", async () => {
    const at = async (serviceIds: number[]) => (await getAvailableSlots(db, { serviceIds, date: "2026-11-02", now })).map((s) => s.start.toISOString());
    expect(await at([1])).toContain("2026-11-02T07:30:00.000Z"); // 13:00 + 30 min ends at 13:30
    const both = await at([1, 2]);
    expect(both).not.toContain("2026-11-02T07:30:00.000Z"); // 13:00 + 45 min runs into the lunch break
    expect(both).toContain("2026-11-02T07:15:00.000Z"); // 12:45 + 45 min ends at 13:30
    expect(await createBooking(db, { ...base, time: "13:00" }, now)).toMatchObject({ ok: false, error: "unavailable" });
  });

  test("only barbers who offer every selected service can be picked", async () => {
    await db.delete(barberServices).where(and(eq(barberServices.barberId, 2), eq(barberServices.serviceId, 2)));
    const slots = await getAvailableSlots(db, { serviceIds: [1, 2], date: "2026-11-02", now });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.barberIds.join() === "1")).toBe(true);
    expect(await createBooking(db, { ...base, barber: 2 }, now)).toMatchObject({ ok: false, error: "unavailable" });
    // "any" never lands on barber 2, even when barber 1 is the busier one
    await createBooking(db, { ...base, serviceIds: [1], barber: 1, time: "10:00" }, now);
    const r = await createBooking(db, { ...base, barber: "any", time: "11:00", name: "Bina", phone: "98250 22222" }, now);
    expect(r.ok).toBe(true);
    expect((await db.select().from(bookings).orderBy(bookings.id))[1].barberId).toBe(1);
  });

  test("rejects an empty selection, duplicates, unknown and inactive services", async () => {
    expect(await createBooking(db, { ...base, serviceIds: [] }, now)).toMatchObject({ ok: false, error: "invalid" });
    expect(await createBooking(db, { ...base, serviceIds: [1, 1] }, now)).toMatchObject({ ok: false, error: "invalid" });
    expect(await createBooking(db, { ...base, serviceIds: [1, 999] }, now)).toMatchObject({ ok: false, error: "unavailable" });
    await db.update(services).set({ active: false }).where(eq(services.id, 2));
    expect(await createBooking(db, base, now)).toMatchObject({ ok: false, error: "unavailable" });
    expect(await getAvailableSlots(db, { serviceIds: [1, 2], date: "2026-11-02", now })).toEqual([]);
    expect(await db.select().from(bookings)).toHaveLength(0);
  });

  test("double submit returns the same booking and does not duplicate lines", async () => {
    const a = await createBooking(db, base, now);
    const b = await createBooking(db, base, now);
    expect(a.ok && b.ok && a.token === b.token).toBe(true);
    expect(await db.select().from(bookings)).toHaveLength(1);
    expect(await db.select().from(bookingServices)).toHaveLength(2);
  });

  test("later edits to a service never change a booking already made", async () => {
    const r = await createBooking(db, base, now);
    if (!r.ok) throw new Error("setup");
    await db.update(services).set({ name: "Renamed", durationMin: 60, priceMinor: 99900 }).where(eq(services.id, 2));
    const got = await getBookingByToken(db, r.token, now);
    expect(got?.services.map((x) => [x.name, x.durationMin, x.priceMinor])).toEqual([["Haircut", 30, 20000], ["Beard trim", 15, 10000]]);
    expect(got?.priceMinor).toBe(30000);
  });

  test("overlap is still refused, and a refused booking leaves no lines behind", async () => {
    await createBooking(db, base, now);
    expect(await createBooking(db, { ...base, time: "10:30", name: "Bina", phone: "98250 22222" }, now)).toMatchObject({ ok: false, error: "unavailable" });
    // bypass the slot check: the exclusion constraint is the referee
    await expect(
      db.insert(bookings).values({
        customerId: 1, barberId: 1, serviceId: 1, during: { start: new Date("2026-11-02T04:45:00Z"), end: new Date("2026-11-02T05:00:00Z") }, source: "web", priceMinor: 1,
      }),
    ).rejects.toThrow();
    expect(await db.select().from(bookings)).toHaveLength(1);
    expect(await db.select().from(bookingServices)).toHaveLength(2);
  });
});

describe("manual bookings with several services", () => {
  const manual = { serviceIds: [1, 2], barberId: 1, date: "2026-11-02", time: "10:00", name: "Caller", phone: "98250 11111", source: "phone" as const };

  test("sums duration and price and writes a line per service", async () => {
    expect((await createManualBooking(db, admin, manual)).ok).toBe(true);
    const [b] = await db.select().from(bookings);
    expect([b.status, b.serviceId, b.priceMinor, b.during.end.toISOString()]).toEqual(["approved", 1, 30000, "2026-11-02T05:15:00.000Z"]);
    expect(await db.select().from(bookingServices)).toHaveLength(2);
  });

  test("refuses duplicates, empty and unknown; overlap leaves nothing behind", async () => {
    expect(await createManualBooking(db, admin, { ...manual, serviceIds: [1, 1] }).catch(() => "threw")).toBe("threw");
    expect(await createManualBooking(db, admin, { ...manual, serviceIds: [] }).catch(() => "threw")).toBe("threw");
    expect(await createManualBooking(db, admin, { ...manual, serviceIds: [1, 999] })).toMatchObject({ ok: false });
    await createManualBooking(db, admin, manual);
    expect(await createManualBooking(db, admin, { ...manual, time: "10:15", name: "Other", phone: "98250 22222" })).toMatchObject({ ok: false });
    expect(await db.select().from(bookings)).toHaveLength(1);
    expect(await db.select().from(bookingServices)).toHaveLength(2);
  });

  test("staff and admin lists show every service", async () => {
    await createManualBooking(db, admin, manual);
    const [row] = await listBookingsFor(db, admin);
    expect(row.service).toBe("Haircut + Beard trim");
    expect(row.services.map((x) => x.name)).toEqual(["Haircut", "Beard trim"]);
    expect((await getBookingFor(db, admin, row.id))?.service).toBe("Haircut + Beard trim");
  });
});

describe("WhatsApp texts with several services", () => {
  test("barber alert and customer decision put the services joined with ' + ' in the same variable", async () => {
    await db.update(barbers).set({ phone: "+91 98250 99999" }).where(eq(barbers.id, 1));
    const r = await createBooking(db, base, now);
    if (!r.ok) throw new Error("setup");
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyNewRequest(db, r.id, { send, siteUrl: "https://salon.test" });
    expect(send.mock.calls[0][0].params).toEqual(["Asha", "Haircut + Beard trim", "Mon 2 Nov, 10:00 am", "https://salon.test/staff"]);
    await notifyDecision(db, r.id, "approved", { send, siteUrl: "https://salon.test" });
    expect(send.mock.calls[1][0].params).toHaveLength(4);
    expect(send.mock.calls[1][0].params[1]).toBe("Haircut + Beard trim");
  });
});
