import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole, type Actor, type Role } from "./access";
import { check } from "./admin-service";
import type { Auth } from "./auth";
import type { Db } from "./db";
import * as s from "./db/schema";

/** Creates a staff login with a hashed password, optionally linked to a barber profile. */
export async function createStaffUser(
  db: Db,
  auth: Auth,
  a: { email: string; name: string; password: string; role: Role; barberId?: number },
) {
  if (a.password.length < 8) throw new Error("Password must be at least 8 characters");
  const ctx = await auth.$context;
  const email = a.email.trim().toLowerCase();
  if (await ctx.internalAdapter.findUserByEmail(email)) throw new Error("A user with this email already exists");
  const hash = await ctx.password.hash(a.password);
  const user = await ctx.internalAdapter.createUser({ email, name: a.name.trim(), role: a.role, emailVerified: true }, { method: "email-password" });
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });
  if (a.barberId) await db.update(s.barbers).set({ userId: user.id }).where(eq(s.barbers.id, a.barberId));
  return user;
}

/** Turns a signed-in user into an Actor, resolving which barber profile they own. */
export async function loadActor(db: Db, userId: string, role: Role): Promise<Actor> {
  const [b] = await db.select({ id: s.barbers.id }).from(s.barbers).where(eq(s.barbers.userId, userId));
  return { userId, role, barberId: b?.id ?? null };
}

// --- Staff management (admin) and own password (any signed-in user) ---
type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const countAdmins = async (db: Db) => (await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.role, "admin"))).length;
const tooShort = "Password must be at least 8 characters";

export async function listStaffUsers(db: Db, actor: Actor | null) {
  requireRole(actor, ["admin"]);
  return db
    .select({ id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role, barberId: s.barbers.id, barber: s.barbers.name })
    .from(s.user)
    .leftJoin(s.barbers, eq(s.barbers.userId, s.user.id))
    .orderBy(asc(s.user.createdAt), asc(s.user.email));
}

/** Name, role and which barber profile this login is. Never demotes the last admin or yourself. */
export async function updateStaffUser(db: Db, actor: Actor | null, input: unknown): Promise<Result> {
  const a = requireRole(actor, ["admin"]);
  const d = check(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1, "Name is required").max(80),
      role: z.enum(["admin", "barber"]),
      barberId: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
    }),
    input,
  );
  const [u] = await db.select().from(s.user).where(eq(s.user.id, d.id));
  if (!u) return fail("Login not found.");
  if (u.role === "admin" && d.role !== "admin") {
    if (u.id === a.userId) return fail("You cannot take admin rights from yourself.");
    if ((await countAdmins(db)) <= 1) return fail("That is the last admin: make someone else an admin first.");
  }
  if (d.barberId) {
    const [b] = await db.select().from(s.barbers).where(eq(s.barbers.id, d.barberId));
    if (!b) return fail("Unknown barber profile.");
    if (b.userId && b.userId !== d.id) {
      const [other] = await db.select({ name: s.user.name }).from(s.user).where(eq(s.user.id, b.userId));
      return fail(`${b.name} is already linked to ${other?.name ?? "another login"}.`);
    }
  }
  await db.update(s.user).set({ name: d.name, role: d.role, updatedAt: new Date() }).where(eq(s.user.id, d.id));
  await db.update(s.barbers).set({ userId: null }).where(eq(s.barbers.userId, d.id));
  if (d.barberId) await db.update(s.barbers).set({ userId: d.id }).where(eq(s.barbers.id, d.barberId));
  return { ok: true };
}

async function setPassword(db: Db, auth: Auth, userId: string, password: string) {
  const hash = await (await auth.$context).password.hash(password);
  await db.update(s.account).set({ password: hash, updatedAt: new Date() }).where(and(eq(s.account.userId, userId), eq(s.account.providerId, "credential")));
  await db.delete(s.session).where(eq(s.session.userId, userId)); // everyone signed in as them is signed out
}

/** Admin sets a new password for any login. */
export async function resetStaffPassword(db: Db, auth: Auth, actor: Actor | null, userId: string, password: string): Promise<Result> {
  requireRole(actor, ["admin"]);
  if (password.length < 8) return fail(tooShort);
  const [u] = await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.id, userId));
  if (!u) return fail("Login not found.");
  await setPassword(db, auth, userId, password);
  return { ok: true };
}

/** Any signed-in user, after proving they know the current password. All sessions are signed out. */
export async function changeOwnPassword(db: Db, auth: Auth, actor: Actor | null, current: string, next: string): Promise<Result> {
  const a = requireRole(actor, ["admin", "barber"]);
  if (next.length < 8) return fail(tooShort);
  const [acc] = await db.select().from(s.account).where(and(eq(s.account.userId, a.userId), eq(s.account.providerId, "credential")));
  const ok = !!acc?.password && (await (await auth.$context).password.verify({ hash: acc.password, password: current }));
  if (!ok) return fail("Your current password is not right.");
  await setPassword(db, auth, a.userId, next);
  return { ok: true };
}

/** Removes the login (sessions and password go with it); a linked barber profile stays, unlinked. */
export async function deleteStaffUser(db: Db, actor: Actor | null, userId: string): Promise<Result> {
  const a = requireRole(actor, ["admin"]);
  if (userId === a.userId) return fail("You cannot delete yourself.");
  const [u] = await db.select().from(s.user).where(eq(s.user.id, userId));
  if (!u) return fail("Login not found.");
  if (u.role === "admin" && (await countAdmins(db)) <= 1) return fail("That is the last admin and cannot be deleted.");
  await db.delete(s.user).where(eq(s.user.id, userId));
  return { ok: true };
}
