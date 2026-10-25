import { eq } from "drizzle-orm";
import type { Actor, Role } from "./access";
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
