import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole, type Actor, type Role } from "./access";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { loadActor } from "./users";

export async function getActor(): Promise<Actor | null> {
  const session = (await (await getAuth()).api.getSession({ headers: await headers() })) as
    | { user: { id: string; role?: string } }
    | null;
  if (!session) return null;
  return loadActor(await getDb(), session.user.id, session.user.role === "admin" ? "admin" : "barber");
}

/** For pages and layouts: send people where they belong. */
export async function requirePage(roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!roles.includes(actor.role)) redirect(actor.role === "admin" ? "/admin" : "/staff");
  return actor;
}

/** For server actions: throws instead of redirecting. Call this first in every action. */
export async function requireActionRole(roles: Role[]): Promise<Actor> {
  return requireRole(await getActor(), roles);
}
