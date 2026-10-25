import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getBarbers } from "@/lib/shop";
import { CreateLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

export default async function UsersPage() {
  const db = await getDb();
  const [users, barbers] = await Promise.all([
    db
      .select({ id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role, barber: s.barbers.name })
      .from(s.user)
      .leftJoin(s.barbers, eq(s.barbers.userId, s.user.id))
      .orderBy(asc(s.user.createdAt)),
    getBarbers(),
  ]);
  return (
    <main className="space-y-8">
      <h1 className="font-serif text-3xl">Users</h1>
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="py-2 text-sm">
            <span className="font-medium">{u.name}</span>{" "}
            <span className="text-muted">
              {u.email}, {u.role}
              {u.barber ? `, barber profile ${u.barber}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <section aria-labelledby="new" className="space-y-4">
        <h2 id="new" className="font-serif text-xl">
          New login
        </h2>
        <CreateLoginForm barbers={barbers.map((b) => ({ id: b.id, name: b.name }))} />
      </section>
    </main>
  );
}
