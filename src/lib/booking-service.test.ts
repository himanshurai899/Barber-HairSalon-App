import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { cancelBooking, createBooking, getAvailableSlots, getBookingByToken } from "./booking-service";
import { bookings, customers } from "./db/schema";
import { createLocalDb } from "./db/local-db";
import { seed } from "./db/seed";

// Seed: Mon-Sat 10:00-20:00 IST, lunch break 13:30-14:30, barbers 1 (Hitesh) and 2, services 1..4 (Haircut = 1, 30 min, 20000).
// 2026-11-02 is a Monday; "now" is the Sunday before.
type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const now = new Date("2026-11-01T06:00:00Z");
const base = { serviceId: 1, barber: 1 as number | "any", date: "2026-11-02", time: "10:00", name: "Asha", phone: "98250 11111" };

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
});

describe("createBooking", () => {
  test("creates a pending web booking with normalised phone and a copied price", async () => {
    const r = await createBooking(db, base, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.token).toMatch(/^[0-9a-f]{32}$/);
    const [b] = await db.select().from(bookings);
    expect(b.status).toBe("pending");
    expect(b.source).toBe("web");
    expect(b.priceMinor).toBe(20000);
    expect(b.during.start.toISOString()).toBe("2026-11-02T04:30:00.000Z");
    expect(b.during.end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    const [c] = await db.select().from(customers);
    expect(c.phone).toBe("+919825011111");
  });

  test("rejects invalid input", async () => {
    expect(await createBooking(db, { ...base, phone: "123" }, now)).toMatchObject({ ok: false, error: "invalid" });
    expect(await createBooking(db, { ...base, name: " " }, now)).toMatchObject({ ok: false, error: "invalid" });
  });

  test("rejects a time that is not on offer (closed hours, lunch break, past notice)", async () => {
    for (const time of ["09:00", "13:30", "20:00"]) {
      expect(await createBooking(db, { ...base, time }, now)).toMatchObject({ ok: false, error: "unavailable" });
    }
    expect(await createBooking(db, { ...base, date: "2026-11-03", time: "10:00" }, new Date("2026-11-03T04:30:00Z"))).toMatchObject({
      ok: false,
      error: "unavailable",
    });
  });

  test("two customers cannot take the same slot", async () => {
    expect((await createBooking(db, base, now)).ok).toBe(true);
    const second = await createBooking(db, { ...base, name: "Bina", phone: "98250 22222" }, now);
    expect(second).toMatchObject({ ok: false, error: "unavailable" });
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  test("double submit returns the same booking instead of an error", async () => {
    const a = await createBooking(db, base, now);
    const b = await createBooking(db, base, now);
    expect(a.ok && b.ok && a.token === b.token).toBe(true);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  test("honeypot filled is rejected without creating anything", async () => {
    expect(await createBooking(db, { ...base, website: "http://spam" }, now)).toMatchObject({ ok: false, error: "invalid" });
    expect(await db.select().from(bookings)).toHaveLength(0);
  });

  test("max open bookings per phone", async () => {
    expect((await createBooking(db, { ...base, time: "10:00" }, now)).ok).toBe(true);
    expect((await createBooking(db, { ...base, time: "11:00" }, now)).ok).toBe(true);
    expect(await createBooking(db, { ...base, time: "12:00" }, now)).toMatchObject({ ok: false, error: "too_many" });
  });

  test("pending bookings past the TTL expire and free the slot", async () => {
    await createBooking(db, base, now);
    const later = new Date(now.getTime() + 3 * 60 * 60_000); // TTL is 120 min
    const r = await createBooking(db, { ...base, name: "Bina", phone: "98250 22222" }, later);
    expect(r.ok).toBe(true);
    const rows = await db.select().from(bookings).orderBy(bookings.id);
    expect(rows.map((x) => x.status)).toEqual(["expired", "pending"]);
  });

  test("any available picks the barber with the fewest bookings that day", async () => {
    await createBooking(db, { ...base, barber: 1, time: "10:00" }, now);
    const r = await createBooking(db, { ...base, barber: "any", time: "11:00", name: "Bina", phone: "98250 22222" }, now);
    expect(r.ok).toBe(true);
    const rows = await db.select().from(bookings).orderBy(bookings.id);
    expect(rows[1].barberId).toBe(2);
  });
});

describe("getAvailableSlots", () => {
  test("hides slots taken by pending bookings", async () => {
    await createBooking(db, base, now);
    const slots = await getAvailableSlots(db, { serviceId: 1, date: "2026-11-02", now });
    const first = slots.find((s) => s.start.toISOString() === "2026-11-02T04:30:00.000Z");
    expect(first?.barberIds).toEqual([2]);
  });
});

describe("cancelBooking / getBookingByToken", () => {
  test("customer cancels a pending booking via the token", async () => {
    const r = await createBooking(db, base, now);
    if (!r.ok) throw new Error("setup");
    expect((await getBookingByToken(db, r.token, now))?.status).toBe("pending");
    expect(await cancelBooking(db, r.token, now)).toEqual({ ok: true });
    expect((await getBookingByToken(db, r.token, now))?.status).toBe("cancelled");
    // slot is free again
    expect((await createBooking(db, { ...base, name: "Bina", phone: "98250 22222" }, now)).ok).toBe(true);
  });

  test("cancelling twice or a rejected booking is refused; unknown token is not found", async () => {
    const r = await createBooking(db, base, now);
    if (!r.ok) throw new Error("setup");
    await cancelBooking(db, r.token, now);
    expect(await cancelBooking(db, r.token, now)).toMatchObject({ ok: false });
    await db.update(bookings).set({ status: "rejected" }).where(eq(bookings.manageToken, r.token));
    expect(await cancelBooking(db, r.token, now)).toMatchObject({ ok: false });
    expect(await getBookingByToken(db, "nope", now)).toBeNull();
    expect(await cancelBooking(db, "nope", now)).toMatchObject({ ok: false });
  });

  test("a lapsed pending booking reads as expired", async () => {
    const r = await createBooking(db, base, now);
    if (!r.ok) throw new Error("setup");
    const later = new Date(now.getTime() + 3 * 60 * 60_000);
    expect((await getBookingByToken(db, r.token, later))?.status).toBe("expired");
  });
});
