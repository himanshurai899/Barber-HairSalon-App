import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { AccessError, type Actor } from "./access";
import { createAuth } from "./auth";
import { createLocalDb } from "./db/local-db";
import { account, barbers, session, user } from "./db/schema";
import { changeOwnPassword, createStaffUser, deleteStaffUser, listStaffUsers, resetStaffPassword, updateStaffUser } from "./users";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
let auth: ReturnType<typeof createAuth>;
let adminId: string;
let admin2Id: string;
let barberId: string;
const as = (userId: string, role: "admin" | "barber", barberId: number | null = null): Actor => ({ userId, role, barberId });
const pw = "correct horse battery";
const signIn = (email: string, password: string) => auth.api.signInEmail({ body: { email, password } });

beforeEach(async () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  db = await createLocalDb();
  auth = createAuth(db);
  await db.insert(barbers).values([{ name: "Hitesh" }, { name: "Demo Barber" }]);
  adminId = (await createStaffUser(db, auth, { email: "boss@example.test", name: "Boss", password: pw, role: "admin" })).id;
  admin2Id = (await createStaffUser(db, auth, { email: "boss2@example.test", name: "Boss Two", password: pw, role: "admin" })).id;
  barberId = (await createStaffUser(db, auth, { email: "hitesh@example.test", name: "Hitesh", password: pw, role: "barber", barberId: 1 })).id;
});

describe("listStaffUsers", () => {
  test("lists every login with its role and barber profile", async () => {
    const rows = await listStaffUsers(db, as(adminId, "admin"));
    expect(rows.map((r) => [r.email, r.role, r.barberId])).toEqual([
      ["boss@example.test", "admin", null],
      ["boss2@example.test", "admin", null],
      ["hitesh@example.test", "barber", 1],
    ]);
    await expect(listStaffUsers(db, as(barberId, "barber", 1))).rejects.toThrow(AccessError);
  });
});

describe("updateStaffUser", () => {
  test("changes name, role and which barber they are", async () => {
    const a = as(adminId, "admin");
    expect(await updateStaffUser(db, a, { id: barberId, name: "Hitesh K", role: "barber", barberId: 2 })).toEqual({ ok: true });
    const [u] = await db.select().from(user).where(eq(user.id, barberId));
    expect([u.name, u.role]).toEqual(["Hitesh K", "barber"]);
    expect((await db.select().from(barbers).where(eq(barbers.userId, barberId))).map((b) => b.id)).toEqual([2]); // moved off barber 1
    expect(await updateStaffUser(db, a, { id: barberId, name: "Hitesh K", role: "admin", barberId: null })).toEqual({ ok: true });
    expect(await db.select().from(barbers).where(eq(barbers.userId, barberId))).toHaveLength(0);
  });

  test("a barber profile belongs to one login", async () => {
    const r = await updateStaffUser(db, as(adminId, "admin"), { id: admin2Id, name: "Boss Two", role: "admin", barberId: 1 });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/already linked to Hitesh/) });
  });

  test("the last admin cannot be demoted, and nobody demotes themselves", async () => {
    const a = as(adminId, "admin");
    expect(await updateStaffUser(db, a, { id: adminId, name: "Boss", role: "barber" })).toMatchObject({ ok: false, error: expect.stringMatching(/yourself/) });
    expect(await updateStaffUser(db, a, { id: admin2Id, name: "Boss Two", role: "barber" })).toEqual({ ok: true });
    // only one admin left now
    expect(await updateStaffUser(db, as(barberId, "admin"), { id: adminId, name: "Boss", role: "barber" })).toMatchObject({ ok: false, error: expect.stringMatching(/last admin/) });
    expect((await db.select().from(user).where(eq(user.id, adminId)))[0].role).toBe("admin");
  });

  test("admin only", async () => {
    await expect(updateStaffUser(db, as(barberId, "barber", 1), { id: barberId, name: "X", role: "admin" })).rejects.toThrow(AccessError);
    await expect(updateStaffUser(db, null, { id: barberId, name: "X", role: "admin" })).rejects.toThrow(AccessError);
  });
});

describe("passwords", () => {
  test("admin resets a password: the new one works, the old one and open sessions do not", async () => {
    await signIn("hitesh@example.test", pw);
    expect(await db.select().from(session).where(eq(session.userId, barberId))).toHaveLength(1);
    expect(await resetStaffPassword(db, auth, as(adminId, "admin"), barberId, "brand new secret")).toEqual({ ok: true });
    await expect(signIn("hitesh@example.test", pw)).rejects.toThrow();
    expect((await signIn("hitesh@example.test", "brand new secret")).user.id).toBe(barberId);
    expect(await resetStaffPassword(db, auth, as(adminId, "admin"), barberId, "short")).toMatchObject({ ok: false });
    expect(await db.select().from(session).where(eq(session.userId, barberId))).toHaveLength(1); // only the one made just now
  });

  test("resetting is admin only", async () => {
    await expect(resetStaffPassword(db, auth, as(barberId, "barber", 1), adminId, "brand new secret")).rejects.toThrow(AccessError);
    await expect(signIn("boss@example.test", "brand new secret")).rejects.toThrow();
  });

  test("anyone signed in can change their own password, with the current one", async () => {
    const me = as(barberId, "barber", 1);
    expect(await changeOwnPassword(db, auth, me, "wrong one entirely", "brand new secret")).toMatchObject({ ok: false, error: expect.stringMatching(/current password/i) });
    expect(await changeOwnPassword(db, auth, me, pw, "short")).toMatchObject({ ok: false });
    expect(await changeOwnPassword(db, auth, me, pw, "brand new secret")).toEqual({ ok: true });
    await expect(signIn("hitesh@example.test", pw)).rejects.toThrow();
    await signIn("hitesh@example.test", "brand new secret");
    await expect(changeOwnPassword(db, auth, null, pw, "brand new secret")).rejects.toThrow(AccessError);
  });
});

describe("deleteStaffUser", () => {
  test("removes the login, its sessions and password, and unlinks the barber profile", async () => {
    await signIn("hitesh@example.test", pw);
    expect(await deleteStaffUser(db, as(adminId, "admin"), barberId)).toEqual({ ok: true });
    expect(await db.select().from(user).where(eq(user.id, barberId))).toHaveLength(0);
    expect(await db.select().from(session).where(eq(session.userId, barberId))).toHaveLength(0);
    expect(await db.select().from(account).where(eq(account.userId, barberId))).toHaveLength(0);
    expect((await db.select().from(barbers).where(eq(barbers.id, 1)))[0].userId).toBeNull(); // profile stays
  });

  test("not yourself, and never the last admin", async () => {
    expect(await deleteStaffUser(db, as(adminId, "admin"), adminId)).toMatchObject({ ok: false, error: expect.stringMatching(/yourself/) });
    expect(await deleteStaffUser(db, as(adminId, "admin"), admin2Id)).toEqual({ ok: true });
    // a barber-session actor cannot do it, and an admin acting as someone else still cannot remove the last admin
    expect(await deleteStaffUser(db, as(barberId, "admin"), adminId)).toMatchObject({ ok: false, error: expect.stringMatching(/last admin/) });
    expect(await db.select().from(user).where(eq(user.id, adminId))).toHaveLength(1);
  });

  test("admin only", async () => {
    await expect(deleteStaffUser(db, as(barberId, "barber", 1), admin2Id)).rejects.toThrow(AccessError);
    await expect(deleteStaffUser(db, null, admin2Id)).rejects.toThrow(AccessError);
  });
});
