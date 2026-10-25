import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, listBookingsFor, type Actor } from "./access";
import { createBooking } from "./booking-service";
import { createLocalDb } from "./db/local-db";
import { bookings, user } from "./db/schema";
import { seed } from "./db/seed";
import { decideBooking, getSchedule } from "./staff-service";

// Seed barbers: 1 (Hitesh), 2. 2026-11-02 is a Monday, shop opens 10:00 IST.
type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const now = new Date("2026-11-01T06:00:00Z");
const hitesh: Actor = { userId: "u1", role: "barber", barberId: 1 };
const other: Actor = { userId: "u2", role: "barber", barberId: 2 };
const admin: Actor = { userId: "u0", role: "admin", barberId: null };

async function book(over: Partial<Parameters<typeof createBooking>[1]> = {}) {
  const r = await createBooking(
    db,
    { serviceId: 1, barber: 1, date: "2026-11-02", time: "10:00", name: "Asha", phone: "98250 11111", ...over },
    now,
  );
  if (!r.ok) throw new Error(`setup failed: ${r.error}`);
  const [row] = await db.select().from(bookings).where(eq(bookings.manageToken, r.token));
  return row;
}

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
  await db.insert(user).values([
    { id: "u0", name: "Admin", email: "admin@example.test", role: "admin" },
    { id: "u1", name: "Hitesh", email: "h@example.test", role: "barber" },
    { id: "u2", name: "Other", email: "o@example.test", role: "barber" },
  ]);
});

describe("decideBooking", () => {
  test("a barber approves their own pending request and it is recorded", async () => {
    const b = await book();
    await decideBooking(db, hitesh, b.id, "approved", undefined, now);
    const [row] = await db.select().from(bookings);
    expect(row.status).toBe("approved");
    expect(row.decidedBy).toBe("u1");
    expect(row.decidedAt).toEqual(now);
  });

  test("rejecting stores the optional reason", async () => {
    const b = await book();
    await decideBooking(db, hitesh, b.id, "rejected", "Away that morning", now);
    const [row] = await db.select().from(bookings);
    expect([row.status, row.decisionNote]).toEqual(["rejected", "Away that morning"]);
  });

  test("a rejected booking frees the slot again", async () => {
    const b = await book();
    await decideBooking(db, hitesh, b.id, "rejected", undefined, now);
    expect((await createBooking(db, { serviceId: 1, barber: 1, date: "2026-11-02", time: "10:00", name: "B", phone: "98250 22222" }, now)).ok).toBe(true);
  });

  test("a barber cannot decide another barber's booking, admin can", async () => {
    const b = await book();
    await expect(decideBooking(db, other, b.id, "approved", undefined, now)).rejects.toThrow(AccessError);
    expect((await db.select().from(bookings))[0].status).toBe("pending");
    await decideBooking(db, admin, b.id, "approved", undefined, now);
    expect((await db.select().from(bookings))[0].status).toBe("approved");
  });

  test("anonymous is rejected", async () => {
    const b = await book();
    await expect(decideBooking(db, null, b.id, "approved", undefined, now)).rejects.toThrow(AccessError);
  });

  test("illegal moves throw: already decided, or not pending any more", async () => {
    const b = await book();
    await decideBooking(db, hitesh, b.id, "approved", undefined, now);
    await expect(decideBooking(db, hitesh, b.id, "rejected", undefined, now)).rejects.toThrow(/Illegal/);
    await expect(decideBooking(db, hitesh, b.id, "approved", undefined, now)).rejects.toThrow(/Illegal/);
  });

  test("a request past its TTL has expired and cannot be approved", async () => {
    const b = await book();
    const later = new Date(now.getTime() + 3 * 60 * 60_000);
    await expect(decideBooking(db, hitesh, b.id, "approved", undefined, later)).rejects.toThrow(/Illegal/);
    expect((await db.select().from(bookings))[0].status).toBe("expired");
  });

  test("unknown booking is treated as not visible", async () => {
    await expect(decideBooking(db, hitesh, 999, "approved", undefined, now)).rejects.toThrow(AccessError);
  });
});

describe("pending list and schedule", () => {
  test("pending requests come oldest first", async () => {
    const later = await book({ time: "11:00", phone: "98250 22222", name: "Later" });
    await db.update(bookings).set({ createdAt: new Date("2026-11-01T05:00:00Z") }).where(eq(bookings.id, later.id));
    await book({ time: "10:00" }); // created at `now`
    const names = (await listBookingsFor(db, hitesh, ["pending"])).map((r) => r.customer);
    expect(names).toEqual(["Later", "Asha"]);
  });

  test("schedule has today and upcoming approved bookings, own only", async () => {
    const a = await book({ time: "10:00" });
    const b = await book({ date: "2026-11-03", time: "10:00", phone: "98250 33333", name: "Tue" });
    await book({ time: "12:00", phone: "98250 44444", name: "Still pending" });
    const o = await book({ barber: 2, time: "10:00", phone: "98250 55555", name: "Not mine" });
    for (const x of [a, b]) await decideBooking(db, hitesh, x.id, "approved", undefined, now);
    await decideBooking(db, other, o.id, "approved", undefined, now);

    const mine = await getSchedule(db, hitesh, new Date("2026-11-02T03:00:00Z")); // Monday 08:30 IST
    expect(mine.map((r) => r.customer)).toEqual(["Asha", "Tue"]);
    expect((await getSchedule(db, admin, new Date("2026-11-02T03:00:00Z"))).map((r) => r.customer)).toEqual(["Asha", "Not mine", "Tue"]);
  });

  test("bookings that ended before today are not in the schedule", async () => {
    const a = await book({ time: "10:00" });
    await decideBooking(db, hitesh, a.id, "approved", undefined, now);
    expect(await getSchedule(db, hitesh, new Date("2026-11-03T03:00:00Z"))).toEqual([]);
  });
});
