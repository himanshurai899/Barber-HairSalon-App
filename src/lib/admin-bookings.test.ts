import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, type Actor } from "./access";
import { copyForWhatsApp, createManualBooking, deleteBooking, deleteNotice, editBooking, overrideStatus, saveNotice, saveSettings } from "./admin-bookings";
import { barberServices, bookingServices, bookings, customers, notices, services, shopSettings, user, waOutbound } from "./db/schema";
import { createLocalDb } from "./db/local-db";
import { seed } from "./db/seed";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const admin: Actor = { userId: "a", role: "admin", barberId: null };
const hitesh: Actor = { userId: "b", role: "barber", barberId: 1 };
const base = { serviceIds: [1], barberId: 1, date: "2026-11-02", time: "10:00", name: "Caller", phone: "98250 11111", source: "phone" as const };

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
  await db.insert(user).values([
    { id: "a", name: "Admin", email: "a@example.test", role: "admin" },
    { id: "b", name: "Hitesh", email: "b@example.test", role: "barber" },
  ]);
});

describe("createManualBooking", () => {
  test("phone booking is approved straight away with its source recorded", async () => {
    const r = await createManualBooking(db, admin, base);
    expect(r.ok).toBe(true);
    const [b] = await db.select().from(bookings);
    expect([b.status, b.source, b.decidedBy, b.priceMinor]).toEqual(["approved", "phone", "a", 20000]);
    expect(b.during.start.toISOString()).toBe("2026-11-02T04:30:00.000Z");
    const [c] = await db.select().from(customers);
    expect([c.phone, c.waOptIn]).toEqual(["+919825011111", false]);
  });

  test("walk-in uses the same path", async () => {
    await createManualBooking(db, admin, { ...base, source: "walk_in" });
    expect((await db.select().from(bookings))[0].source).toBe("walk_in");
  });

  test("overlap with an existing booking is refused cleanly", async () => {
    await createManualBooking(db, admin, base);
    expect(await createManualBooking(db, admin, { ...base, name: "Other", phone: "98250 22222" })).toMatchObject({ ok: false, error: expect.stringMatching(/already booked/) });
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  test("invalid phone or unknown service is refused", async () => {
    expect(await createManualBooking(db, admin, { ...base, phone: "123456" })).toMatchObject({ ok: false });
    expect(await createManualBooking(db, admin, { ...base, serviceIds: [999] })).toMatchObject({ ok: false });
  });

  test("a barber can only book for themselves; anonymous is rejected", async () => {
    expect((await createManualBooking(db, hitesh, base)).ok).toBe(true);
    await expect(createManualBooking(db, hitesh, { ...base, barberId: 2, time: "12:00" })).rejects.toThrow(AccessError);
    await expect(createManualBooking(db, null, base)).rejects.toThrow(AccessError);
  });
});

describe("overrideStatus", () => {
  test("admin can change any status, others cannot", async () => {
    await createManualBooking(db, admin, base);
    const [b] = await db.select().from(bookings);
    await expect(overrideStatus(db, hitesh, b.id, "cancelled")).rejects.toThrow(AccessError);
    expect(await overrideStatus(db, admin, b.id, "cancelled")).toEqual({ ok: true });
    expect((await db.select().from(bookings))[0].status).toBe("cancelled");
  });

  test("reviving a booking whose slot was taken is refused", async () => {
    await createManualBooking(db, admin, base);
    const [b] = await db.select().from(bookings);
    await overrideStatus(db, admin, b.id, "cancelled");
    await createManualBooking(db, admin, { ...base, name: "Other", phone: "98250 22222" });
    expect(await overrideStatus(db, admin, b.id, "approved")).toMatchObject({ ok: false });
  });
});

describe("notices", () => {
  test("save, validate dates, delete", async () => {
    await saveNotice(db, admin, { kind: "offer", title: "Diwali", body: "20% off", badge: "Offer", startsOn: "2026-11-01", endsOn: "2026-11-10" });
    expect(await db.select().from(notices).where(eq(notices.title, "Diwali"))).toHaveLength(1);
    await expect(saveNotice(db, admin, { kind: "notice", title: "X", startsOn: "2026-11-10", endsOn: "2026-11-01" })).rejects.toThrow(/before/);
    await expect(saveNotice(db, admin, { kind: "notice", title: " " })).rejects.toThrow();
    await expect(saveNotice(db, hitesh, { kind: "notice", title: "X" })).rejects.toThrow(AccessError);
    const [n] = await db.select().from(notices).where(eq(notices.title, "Diwali"));
    await deleteNotice(db, admin, n.id);
    expect(await db.select().from(notices).where(eq(notices.title, "Diwali"))).toHaveLength(0);
  });

  test("copy for WhatsApp uses bold and emoji", () => {
    const text = copyForWhatsApp({ kind: "offer", title: "Diwali offer", body: "20% off all services", badge: null, startsOn: "2026-11-01", endsOn: "2026-11-10" });
    expect(text).toBe("🎁 *Diwali offer*\n20% off all services\n_1 Nov to 10 Nov_");
    expect(copyForWhatsApp({ kind: "notice", title: "Closed Sunday", body: "", badge: null, startsOn: null, endsOn: null })).toBe("📢 *Closed Sunday*");
  });
});

describe("saveSettings", () => {
  const valid = {
    name: "Krishna Hair Salon", tagline: "Where Style Meets Perfection", address: "Gotri, Vadodara", timezone: "Asia/Kolkata", currency: "INR",
    greetingText: "Hi {name}", pendingTtlMin: 90, slotStepMin: 15, minNoticeMin: 30, horizonDays: 21, maxOpenPerPhone: 3,
  };
  test("persists valid settings", async () => {
    await saveSettings(db, admin, { ...valid, phone: "+91 98250 00000", lat: "22.31", lng: "73.14" });
    const [s] = await db.select().from(shopSettings);
    expect([s.pendingTtlMin, s.horizonDays, s.phone, s.lat]).toEqual([90, 21, "+91 98250 00000", "22.31"]);
  });
  test("rejects bad values", async () => {
    await expect(saveSettings(db, admin, { ...valid, pendingTtlMin: 0 })).rejects.toThrow();
    await expect(saveSettings(db, admin, { ...valid, timezone: "Mars/Base" })).rejects.toThrow(/timezone/i);
    await expect(saveSettings(db, admin, { ...valid, lat: "abc" })).rejects.toThrow();
    await expect(saveSettings(db, hitesh, valid)).rejects.toThrow(AccessError);
  });
});

describe("editBooking", () => {
  const now = new Date("2026-10-30T00:00:00Z");
  const edit = (over: object = {}, who: Actor | null = admin) => editBooking(db, who, { ...base, name: "Caller", ...over, id: 1 }, now);
  beforeEach(async () => {
    await createManualBooking(db, admin, base);
  });

  test("reschedules and changes barber, keeping the booking itself out of the conflict check", async () => {
    // 10:15 overlaps the booking's own old slot: only legal because it is excluded
    expect(await edit({ time: "10:15" })).toEqual({ ok: true });
    let [b] = await db.select().from(bookings);
    expect(b.during.start.toISOString()).toBe("2026-11-02T04:45:00.000Z");
    expect(b.during.end.toISOString()).toBe("2026-11-02T05:15:00.000Z");
    expect(await edit({ barberId: 2, time: "12:00" })).toEqual({ ok: true });
    [b] = await db.select().from(bookings);
    expect([b.barberId, b.status]).toEqual([2, "approved"]);
  });

  test("a time another booking holds, or outside the barber's day, is refused", async () => {
    await createManualBooking(db, admin, { ...base, time: "12:00", name: "Other", phone: "98250 33333" });
    expect(await edit({ time: "12:00" })).toMatchObject({ ok: false, error: expect.stringMatching(/not available/) });
    expect(await edit({ time: "22:00" })).toMatchObject({ ok: false });
    expect((await db.select().from(bookings).where(eq(bookings.id, 1)))[0].during.start.toISOString()).toBe("2026-11-02T04:30:00.000Z");
  });

  test("the barber must offer every selected service", async () => {
    await db.delete(barberServices).where(and(eq(barberServices.barberId, 1), eq(barberServices.serviceId, 2)));
    expect(await edit({ serviceIds: [1, 2] })).toMatchObject({ ok: false, error: expect.stringMatching(/not available/) });
  });

  test("changing services recomputes length, price, lines and the primary service", async () => {
    expect(await edit({ serviceIds: [2, 1] })).toEqual({ ok: true });
    const [b] = await db.select().from(bookings);
    expect([b.serviceId, b.priceMinor, b.during.end.getTime() - b.during.start.getTime()]).toEqual([1, 30000, 45 * 60_000]);
    const lines = await db.select().from(bookingServices).where(eq(bookingServices.bookingId, 1));
    expect(lines.map((l) => l.name).sort()).toEqual(["Beard trim", "Haircut"]);
  });

  test("unchanged services keep their price snapshot even after the service price changed", async () => {
    await db.update(services).set({ priceMinor: 99900 }).where(eq(services.id, 1));
    expect(await edit({ note: "Bring photo", time: "11:00" })).toEqual({ ok: true });
    const [b] = await db.select().from(bookings);
    expect([b.priceMinor, b.note]).toEqual([20000, "Bring photo"]);
    expect((await db.select().from(bookingServices))[0].priceMinor).toBe(20000);
  });

  test("a different phone moves the booking to that client, without duplicating clients", async () => {
    expect(await edit({ name: "New Person", phone: "+91 98250 44444" })).toEqual({ ok: true });
    expect(await edit({ name: "New Person", phone: "09825044444" })).toEqual({ ok: true });
    const cs = await db.select().from(customers);
    expect(cs.map((c) => c.phone).sort()).toEqual(["+919825011111", "+919825044444"]);
    expect((await db.select().from(bookings))[0].customerId).toBe(cs.find((c) => c.phone === "+919825044444")!.id);
    expect(await edit({ phone: "123456" })).toMatchObject({ ok: false });
  });

  test("only admins edit; barbers and anonymous are rejected", async () => {
    await expect(edit({}, hitesh)).rejects.toThrow(AccessError);
    await expect(edit({}, null)).rejects.toThrow(AccessError);
  });
});

describe("deleteBooking", () => {
  test("removes the booking and its lines, keeps the message log row, admin only", async () => {
    await createManualBooking(db, admin, base);
    await db.insert(waOutbound).values({ bookingId: 1, template: "t", status: "sent" });
    await expect(deleteBooking(db, hitesh, 1)).rejects.toThrow(AccessError);
    await expect(deleteBooking(db, null, 1)).rejects.toThrow(AccessError);
    expect(await deleteBooking(db, admin, 1)).toEqual({ ok: true });
    expect(await db.select().from(bookings)).toHaveLength(0);
    expect(await db.select().from(bookingServices)).toHaveLength(0);
    expect((await db.select().from(waOutbound))[0].bookingId).toBeNull();
    expect(await deleteBooking(db, admin, 1)).toMatchObject({ ok: false });
  });
});
