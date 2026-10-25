import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, getBookingFor, listBookingsFor, requireRole, type Actor } from "./access";
import { createLocalDb } from "./db/local-db";
import { barbers, bookings, customers, services, user } from "./db/schema";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
let bookingIds: { a: number; b: number };

const admin: Actor = { userId: "u-admin", role: "admin", barberId: null };
const barberA: Actor = { userId: "u-a", role: "barber", barberId: 1 };
const barberB: Actor = { userId: "u-b", role: "barber", barberId: 2 };
const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h));

beforeEach(async () => {
  db = await createLocalDb();
  await db.insert(user).values([
    { id: "u-a", name: "A", email: "a@example.test", role: "barber" },
    { id: "u-b", name: "B", email: "b@example.test", role: "barber" },
  ]);
  await db.insert(barbers).values([
    { name: "A", userId: "u-a" },
    { name: "B", userId: "u-b" },
  ]);
  const [svc] = await db.insert(services).values({ name: "Cut", durationMin: 30, priceMinor: 100 }).returning();
  const [c] = await db.insert(customers).values({ phone: "+919800000001", name: "C" }).returning();
  const mk = (barberId: number, h: number) => ({
    customerId: c.id, barberId, serviceId: svc.id, during: { start: at(h), end: at(h + 1) }, source: "web" as const, priceMinor: 100,
  });
  const [a, b] = await db.insert(bookings).values([mk(1, 4), mk(2, 4)]).returning();
  bookingIds = { a: a.id, b: b.id };
});

describe("requireRole", () => {
  test("anonymous is rejected", () => {
    expect(() => requireRole(null, ["admin", "barber"])).toThrow(AccessError);
    expect(() => requireRole(undefined, ["barber"])).toThrow(/unauthenticated/);
  });
  test("wrong role is forbidden", () => {
    expect(() => requireRole(barberA, ["admin"])).toThrow(/forbidden/);
    expect(requireRole(admin, ["admin"])).toBe(admin);
  });
});

describe("booking visibility", () => {
  test("a barber only lists their own bookings", async () => {
    expect((await listBookingsFor(db, barberA)).map((b) => b.id)).toEqual([bookingIds.a]);
    expect((await listBookingsFor(db, barberB)).map((b) => b.id)).toEqual([bookingIds.b]);
  });
  test("a barber cannot open another barber's booking", async () => {
    expect(await getBookingFor(db, barberA, bookingIds.b)).toBeNull();
    expect((await getBookingFor(db, barberA, bookingIds.a))?.id).toBe(bookingIds.a);
  });
  test("admin sees everything", async () => {
    expect(await listBookingsFor(db, admin)).toHaveLength(2);
    expect((await getBookingFor(db, admin, bookingIds.b))?.id).toBe(bookingIds.b);
  });
  test("a barber login not linked to a barber sees nothing", async () => {
    expect(await listBookingsFor(db, { userId: "x", role: "barber", barberId: null })).toEqual([]);
  });
  test("anonymous is rejected", async () => {
    await expect(listBookingsFor(db, null)).rejects.toThrow(AccessError);
    await expect(getBookingFor(db, null, 1)).rejects.toThrow(AccessError);
  });
});
