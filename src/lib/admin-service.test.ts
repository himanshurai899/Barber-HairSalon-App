import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, type Actor } from "./access";
import {
  addSpecialHours,
  addTimeOff,
  parseWindows,
  saveAvailability,
  saveBarber,
  saveService,
  saveShopHours,
} from "./admin-service";
import { getAvailableSlots } from "./booking-service";
import { createLocalDb } from "./db/local-db";
import { availability, barberServices, barbers, services, shopHours, specialHours, timeOff } from "./db/schema";
import { seed } from "./db/seed";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const admin: Actor = { userId: "a", role: "admin", barberId: null };
const barber: Actor = { userId: "b", role: "barber", barberId: 1 };
const now = new Date("2026-11-01T06:00:00Z");

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
});

describe("parseWindows", () => {
  test("parses comma separated windows and blank as closed", () => {
    expect(parseWindows("10:00-13:30, 14:30 - 20:00")).toEqual([
      { start: "10:00", end: "13:30" },
      { start: "14:30", end: "20:00" },
    ]);
    expect(parseWindows("  ")).toEqual([]);
  });
  test("rejects bad formats, backwards and overlapping windows", () => {
    expect(() => parseWindows("10-12")).toThrow(/10:00/);
    expect(() => parseWindows("25:00-26:00")).toThrow();
    expect(() => parseWindows("12:00-10:00")).toThrow(/after/);
    expect(() => parseWindows("10:00-12:00, 11:00-13:00")).toThrow(/overlap/);
  });
});

describe("access", () => {
  test("only admins may change anything", async () => {
    const input = { name: "X", durationMin: 30, price: 100 };
    await expect(saveService(db, barber, input)).rejects.toThrow(AccessError);
    await expect(saveService(db, null, input)).rejects.toThrow(AccessError);
    await expect(addTimeOff(db, barber, { barberId: 1, from: "2026-11-02", to: "2026-11-02" })).rejects.toThrow(AccessError);
    await expect(saveShopHours(db, barber, {})).rejects.toThrow(AccessError);
  });
});

describe("services and barbers", () => {
  test("price is entered in rupees and stored in minor units", async () => {
    await saveService(db, admin, { name: "Facial", category: "Skin", durationMin: 45, price: 450.5 });
    const [s] = await db.select().from(services).where(eq(services.name, "Facial"));
    expect(s.priceMinor).toBe(45050);
  });
  test("service validation", async () => {
    await expect(saveService(db, admin, { name: "", durationMin: 30, price: 10 })).rejects.toThrow();
    await expect(saveService(db, admin, { name: "A", durationMin: 0, price: 10 })).rejects.toThrow();
    await expect(saveService(db, admin, { name: "A", durationMin: 30, price: -1 })).rejects.toThrow();
  });
  test("editing a service keeps its id", async () => {
    await saveService(db, admin, { id: 1, name: "Haircut deluxe", durationMin: 40, price: 300 });
    const [s] = await db.select().from(services).where(eq(services.id, 1));
    expect([s.name, s.durationMin, s.priceMinor]).toEqual(["Haircut deluxe", 40, 30000]);
  });
  test("saving a barber replaces the services they offer", async () => {
    await saveBarber(db, admin, { id: 2, name: "Demo Barber", instagram: "@demo", serviceIds: [1, 2] });
    const rows = await db.select().from(barberServices).where(eq(barberServices.barberId, 2));
    expect(rows.map((r) => r.serviceId).sort()).toEqual([1, 2]);
    const [b] = await db.select().from(barbers).where(eq(barbers.id, 2));
    expect(b.instagram).toBe("demo");
  });
  test("a barber needs a name", async () => {
    await expect(saveBarber(db, admin, { name: " ", serviceIds: [] })).rejects.toThrow();
  });
});

describe("hours", () => {
  test("weekly shop hours are replaced from one line per weekday", async () => {
    await saveShopHours(db, admin, { 1: "09:00-18:00", 2: "09:00-18:00", 0: "" });
    const rows = await db.select().from(shopHours);
    expect(rows.map((r) => [r.weekday, r.opens, r.closes]).sort()).toEqual([
      [1, "09:00:00", "18:00:00"],
      [2, "09:00:00", "18:00:00"],
    ]);
  });
  test("a shop day cannot have two windows", async () => {
    await expect(saveShopHours(db, admin, { 1: "09:00-12:00, 13:00-18:00" })).rejects.toThrow(/one/);
  });
  test("special hours need a sensible date range and times", async () => {
    await addSpecialHours(db, admin, { startsOn: "2026-10-11", endsOn: "2026-10-19", opens: "09:00", closes: "20:00", label: "Navratri" });
    expect(await db.select().from(specialHours)).toHaveLength(2); // seed has one already
    await expect(addSpecialHours(db, admin, { startsOn: "2026-10-19", endsOn: "2026-10-11", opens: "09:00", closes: "20:00" })).rejects.toThrow();
    await expect(addSpecialHours(db, admin, { startsOn: "2026-10-11", endsOn: "2026-10-12", opens: "20:00", closes: "09:00" })).rejects.toThrow();
    await addSpecialHours(db, admin, { startsOn: "2026-12-25", endsOn: "2026-12-25", closed: true, label: "Holiday" });
  });
  test("availability replaces a barber's windows and validates", async () => {
    await saveAvailability(db, admin, 1, { 1: "10:00-12:00, 13:00-15:00" });
    const rows = await db.select().from(availability).where(eq(availability.barberId, 1));
    expect(rows).toHaveLength(2);
    await expect(saveAvailability(db, admin, 1, { 1: "10:00-12:00, 11:00-13:00" })).rejects.toThrow(/overlap/);
    expect(await db.select().from(availability).where(eq(availability.barberId, 1))).toHaveLength(2); // unchanged
  });
});

describe("time off", () => {
  test("hides only that barber's slots for the days covered, inclusive of the last day", async () => {
    const before = await getAvailableSlots(db, { serviceIds: [1], date: "2026-11-02", now });
    expect(before[0].barberIds).toEqual([1, 2]);
    await addTimeOff(db, admin, { barberId: 1, from: "2026-11-02", to: "2026-11-03", reason: "Away" });
    for (const date of ["2026-11-02", "2026-11-03"]) {
      const slots = await getAvailableSlots(db, { serviceIds: [1], date, now });
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.barberIds.join() === "2")).toBe(true);
    }
    const after = await getAvailableSlots(db, { serviceIds: [1], date: "2026-11-04", now });
    expect(after[0].barberIds).toEqual([1, 2]);
    expect(await db.select().from(timeOff)).toHaveLength(1);
  });
  test("end date before start date is rejected", async () => {
    await expect(addTimeOff(db, admin, { barberId: 1, from: "2026-11-03", to: "2026-11-02" })).rejects.toThrow(/before/);
  });
});
