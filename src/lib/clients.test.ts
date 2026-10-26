import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, type Actor } from "./access";
import { createManualBooking, editBooking } from "./admin-bookings";
import { saveBarber } from "./admin-service";
import { createBooking } from "./booking-service";
import { deleteClient, getClient, listClients, saveClient } from "./clients";
import { barbers, bookings, customers, user } from "./db/schema";
import { createLocalDb } from "./db/local-db";
import { seed } from "./db/seed";
import { normalizePhone } from "./phone";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const admin: Actor = { userId: "a", role: "admin", barberId: null };
const barber: Actor = { userId: "b", role: "barber", barberId: 1 };
const now = new Date("2026-10-30T00:00:00Z");
const variants = ["+91 99134 07166", "09913407166", "9913407166", "919913407166", "+91-9913407166", "(+91) 99134 07166"];
const manual = { serviceIds: [1], barberId: 1, date: "2026-11-02", time: "10:00", name: "Caller", source: "phone" as const };

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
  await db.insert(user).values({ id: "a", name: "Admin", email: "a@example.test", role: "admin" });
});

describe("normalizePhone", () => {
  test("every way of writing one Indian number collapses to the same E.164 value", () => {
    for (const v of variants) expect(normalizePhone(v)).toBe("+919913407166");
  });
  test("rubbish is null", () => {
    for (const v of ["", "123", "abc", "99134"]) expect(normalizePhone(v)).toBeNull();
  });
});

describe("one client per number, whichever way it arrives", () => {
  test("public booking, manual booking, booking edit and admin form all land on one row", async () => {
    const pub = await createBooking(db, { serviceIds: [1], barber: 1, date: "2026-11-03", time: "10:00", name: "Web Name", phone: variants[0] }, now);
    expect(pub.ok).toBe(true);
    expect((await createManualBooking(db, admin, { ...manual, phone: variants[1] })).ok).toBe(true);
    expect(await editBooking(db, admin, { ...manual, id: 2, phone: variants[2], name: "Caller" }, now)).toEqual({ ok: true });
    expect(await saveClient(db, admin, { name: "Again", phone: variants[3] })).toMatchObject({ ok: false, error: expect.stringMatching(/already exists: /) });
    expect(await db.select().from(customers)).toHaveLength(1);
  });

  test("simultaneous submits with different spellings of one number never create two clients", async () => {
    const slot = (i: number, phone: string) =>
      createBooking(db, { serviceIds: [1], barber: 1, date: "2026-11-04", time: `1${i}:00`, name: `P${i}`, phone }, now);
    await Promise.all(variants.map((v, i) => slot(i, v)));
    expect(await db.select().from(customers)).toHaveLength(1);
  });
});

describe("saveClient", () => {
  test("creates with normalised phone, optional email and notes", async () => {
    const r = await saveClient(db, admin, { name: " Ravi ", phone: variants[1], email: "ravi@example.com", notes: "Allergic to ammonia", waOptIn: true });
    expect(r).toMatchObject({ ok: true });
    const [c] = await db.select().from(customers);
    expect([c.name, c.phone, c.email, c.notes, c.waOptIn]).toEqual(["Ravi", "+919913407166", "ravi@example.com", "Allergic to ammonia", true]);
  });

  test("duplicate number is refused on create and on edit, naming the existing client", async () => {
    await saveClient(db, admin, { name: "Ravi", phone: "99134 07166" });
    const other = await saveClient(db, admin, { name: "Meena", phone: "98250 11111" });
    expect(await saveClient(db, admin, { name: "Dup", phone: "+919913407166" })).toEqual({ ok: false, error: "A client with this number already exists: Ravi" });
    const id = (other as { id: number }).id;
    expect(await saveClient(db, admin, { id, name: "Meena", phone: "09913407166" })).toEqual({ ok: false, error: "A client with this number already exists: Ravi" });
    expect(await saveClient(db, admin, { id, name: "Meena K", phone: "098250 11111", email: "" })).toMatchObject({ ok: true }); // own number is fine
    expect((await db.select().from(customers).where(eq(customers.id, id)))[0].name).toBe("Meena K");
  });

  test("validates name, phone and email", async () => {
    await expect(saveClient(db, admin, { name: "", phone: "9913407166" })).rejects.toThrow();
    expect(await saveClient(db, admin, { name: "X", phone: "12345" })).toMatchObject({ ok: false });
    await expect(saveClient(db, admin, { name: "X", phone: "9913407166", email: "nope" })).rejects.toThrow();
  });

  test("admin only", async () => {
    await expect(saveClient(db, barber, { name: "X", phone: "9913407166" })).rejects.toThrow(AccessError);
    await expect(saveClient(db, null, { name: "X", phone: "9913407166" })).rejects.toThrow(AccessError);
  });
});

describe("list, search and detail", () => {
  beforeEach(async () => {
    await saveClient(db, admin, { name: "Asha Patel", phone: "98250 11111" });
    await saveClient(db, admin, { name: "Bhavin Shah", phone: "99134 07166" });
    await createManualBooking(db, admin, { ...manual, name: "Asha Patel", phone: "98250 11111", date: "2026-11-02" });
    await createManualBooking(db, admin, { ...manual, name: "Bhavin Shah", phone: "99134 07166", date: "2026-11-09" });
    await createManualBooking(db, admin, { ...manual, name: "Bhavin Shah", phone: "99134 07166", date: "2026-11-10", serviceIds: [1, 2] });
  });

  test("sorted by last visit, newest first, clients without visits last", async () => {
    await saveClient(db, admin, { name: "Never Came", phone: "97000 00001" });
    const rows = await listClients(db, admin);
    expect(rows.map((r) => r.name)).toEqual(["Bhavin Shah", "Asha Patel", "Never Came"]);
    expect(rows[0]).toMatchObject({ bookingCount: 2 });
    expect(rows[2]).toMatchObject({ bookingCount: 0, lastVisit: null });
  });

  test("search by name part or by phone in any spelling", async () => {
    expect((await listClients(db, admin, "patel")).map((r) => r.name)).toEqual(["Asha Patel"]);
    expect((await listClients(db, admin, "09913407166")).map((r) => r.name)).toEqual(["Bhavin Shah"]);
    expect((await listClients(db, admin, "+91 98250")).map((r) => r.name)).toEqual(["Asha Patel"]);
    expect(await listClients(db, admin, "zzz")).toEqual([]);
  });

  test("detail has first and last visit, counts, approved total and history with services joined", async () => {
    const id = (await db.select().from(customers).where(eq(customers.name, "Bhavin Shah")))[0].id;
    const c = await getClient(db, admin, id);
    expect(c).toMatchObject({ name: "Bhavin Shah", bookingCount: 2, approvedTotalMinor: 20000 + 30000 });
    expect(c!.firstVisit!.toISOString()).toBe("2026-11-09T04:30:00.000Z");
    expect(c!.lastVisit!.toISOString()).toBe("2026-11-10T04:30:00.000Z");
    expect(c!.history.map((h) => h.service)).toEqual(["Haircut + Beard trim", "Haircut"]); // newest first
    expect(c!.history[0]).toMatchObject({ barber: "Hitesh", status: "approved" });
    expect(await getClient(db, admin, 9999)).toBeNull();
  });

  test("only admins read clients", async () => {
    await expect(listClients(db, barber)).rejects.toThrow(AccessError);
    await expect(getClient(db, barber, 1)).rejects.toThrow(AccessError);
  });
});

describe("deleteClient", () => {
  test("blocked while they have bookings, allowed otherwise, admin only", async () => {
    await createManualBooking(db, admin, { ...manual, phone: "98250 11111" });
    const [c] = await db.select().from(customers);
    expect(await deleteClient(db, admin, c.id)).toEqual({ ok: false, error: `"Caller" has 1 booking, so the client cannot be deleted.` });
    await db.delete(bookings);
    await expect(deleteClient(db, barber, c.id)).rejects.toThrow(AccessError);
    expect(await deleteClient(db, admin, c.id)).toEqual({ ok: true });
    expect(await db.select().from(customers)).toHaveLength(0);
    expect(await deleteClient(db, admin, c.id)).toMatchObject({ ok: false });
  });
});

describe("barber phone numbers are unique too", () => {
  test("normalised on save, and a number another barber uses is refused", async () => {
    await saveBarber(db, admin, { id: 1, name: "Hitesh", phone: "99134 07166", serviceIds: [] });
    expect((await db.select().from(barbers).where(eq(barbers.id, 1)))[0].phone).toBe("+919913407166");
    await expect(saveBarber(db, admin, { id: 2, name: "Demo Barber", phone: "09913407166", serviceIds: [] })).rejects.toThrow(/already used by Hitesh/);
    await saveBarber(db, admin, { id: 1, name: "Hitesh", phone: "09913407166", serviceIds: [] }); // own number
    await expect(saveBarber(db, admin, { name: "Typo", phone: "12345", serviceIds: [] })).rejects.toThrow(/phone/i);
    await saveBarber(db, admin, { id: 2, name: "Demo Barber", serviceIds: [] }); // no number is fine, any number of times
  });
  test("the database itself refuses two barbers with one number", async () => {
    await db.update(barbers).set({ phone: "+919913407166" }).where(eq(barbers.id, 1));
    await expect(db.update(barbers).set({ phone: "+919913407166" }).where(eq(barbers.id, 2))).rejects.toThrow();
  });
});
