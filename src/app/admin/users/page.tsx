import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { listStaffUsers } from "@/lib/users";
import { AdminForm, Field } from "../admin-form";
import { CreateLoginForm } from "./login-form";
import { resetPasswordAction, updateLoginAction } from "./actions";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

const select = "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3";

export default function UsersPage() {
  return (
    <main className="max-w-md space-y-8">
      <h1 className="font-serif text-3xl">Users</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Body />
      </Suspense>
    </main>
  );
}

async function Body() {
  const actor = await requirePage(["admin"]);
  const db = await getDb();
  const [users, barbers] = await Promise.all([listStaffUsers(db, actor), db.select({ id: s.barbers.id, name: s.barbers.name }).from(s.barbers).orderBy(asc(s.barbers.sort), asc(s.barbers.id))]);
  return (
    <>
      <p className="text-sm text-muted">
        Your own password:{" "}
        <Link href="/account/password" className="underline">
          change it here
        </Link>
        .
      </p>
      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="space-y-6 rounded-md border border-line bg-surface p-4">
            <summary className="min-h-11 cursor-pointer py-2">
              <span className="font-medium">{u.name}</span>{" "}
              <span className="text-sm text-muted">
                {u.email}, {u.role}
                {u.barber ? `, ${u.barber}` : ""}
                {u.id === actor.userId ? " (you)" : ""}
              </span>
            </summary>
            <AdminForm action={updateLoginAction}>
              <input type="hidden" name="id" value={u.id} />
              <Field label="Name" name="name" defaultValue={u.name} required />
              <label className="block text-sm">
                Role
                <select name="role" defaultValue={u.role} className={select}>
                  <option value="barber">Barber</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="block text-sm">
                Barber profile
                <select name="barberId" defaultValue={u.barberId ?? ""} className={select}>
                  <option value="">None</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </AdminForm>
            <section aria-label={`Reset password for ${u.name}`} className="space-y-2">
              <h2 className="font-medium">Reset password</h2>
              <p className="text-sm text-muted">Sets a new password and signs them out everywhere.</p>
              <AdminForm action={resetPasswordAction} submit="Reset password" tone="quiet">
                <input type="hidden" name="id" value={u.id} />
                <Field label="New password (8 or more characters)" name="password" required />
              </AdminForm>
            </section>
            {u.id !== actor.userId && (
              <Link href={`/admin/users/${u.id}/delete`} className="inline-flex min-h-11 items-center text-warn underline">
                Delete login
              </Link>
            )}
          </details>
        ))}
      </div>
      <section aria-labelledby="new" className="space-y-4">
        <h2 id="new" className="font-serif text-xl">
          New login
        </h2>
        <CreateLoginForm barbers={barbers} />
      </section>
    </>
  );
}
