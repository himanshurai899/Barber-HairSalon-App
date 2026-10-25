import { beforeEach, describe, expect, test } from "vitest";
import { createLocalDb } from "./local-db";
import { barbers, bookings, customers, services, shopSettings } from "./schema";
import { seed } from "./seed";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
let ids: { b1: number; b2: number; svc: number; cust: number };

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 1, h, m));
const range = (s: Date, e: Date) => ({ start: s, end: e });

function book(barberId: number, start: Date, end: Date, status: "pending" | "approved" | "rejected" = "pending") {
  return db.insert(bookings).values({
    customerId: ids.cust,
    barberId,
    serviceId: ids.svc,
    during: range(start, end),
    status,
    source: "web",
    priceMinor: 30000,
  });
}

beforeEach(async () => {
  db = await createLocalDb();
  const [b1, b2] = await db.insert(barbers).values([{ name: "A" }, { name: "B" }]).returning();
  const [svc] = await db.insert(services).values({ name: "Haircut", durationMin: 60, priceMinor: 30000 }).returning();
  const [cust] = await db.insert(customers).values({ phone: "+919800000000", name: "C" }).returning();
  ids = { b1: b1.id, b2: b2.id, svc: svc.id, cust: cust.id };
});

describe("no_overlap constraint", () => {
  test("rejects an overlapping pending booking for the same barber", async () => {
    await book(ids.b1, at(10), at(11));
    await expect(book(ids.b1, at(10, 30), at(11, 30))).rejects.toThrow();
  });

  test("rejects overlap with an approved booking", async () => {
    await book(ids.b1, at(10), at(11), "approved");
    await expect(book(ids.b1, at(10), at(11))).rejects.toThrow();
  });

  test("allows back-to-back bookings (ranges are [) )", async () => {
    await book(ids.b1, at(10), at(11));
    await book(ids.b1, at(11), at(12));
  });

  test("allows the same time for another barber", async () => {
    await book(ids.b1, at(10), at(11));
    await book(ids.b2, at(10), at(11));
  });

  test("rejected bookings do not block the slot", async () => {
    await book(ids.b1, at(10), at(11), "rejected");
    await book(ids.b1, at(10), at(11));
  });

  test("range round-trips through the driver", async () => {
    await book(ids.b1, at(10), at(11));
    const [row] = await db.select().from(bookings);
    expect(row.during.start.toISOString()).toBe(at(10).toISOString());
    expect(row.during.end.toISOString()).toBe(at(11).toISOString());
    expect(row.manageToken).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("other constraints", () => {
  test("customer phone is unique", async () => {
    await expect(db.insert(customers).values({ phone: "+919800000000", name: "D" })).rejects.toThrow();
  });
  test("end must be after start", async () => {
    await expect(book(ids.b1, at(11), at(10))).rejects.toThrow();
  });
});

test("seed script runs on a fresh migrated database", async () => {
  const fresh = await createLocalDb();
  await seed(fresh);
  expect((await fresh.select().from(services)).length).toBeGreaterThan(0);
  expect((await fresh.select().from(shopSettings)).length).toBe(1);
});
