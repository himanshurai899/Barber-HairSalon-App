import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { listClients } from "@/lib/clients";
import { inZone } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/shop";
import { AdminForm } from "../admin-form";
import { saveClientAction } from "../actions";
import { ClientFields } from "./client-fields";

export const metadata: Metadata = { title: "Clients", robots: { index: false } };

export default function ClientsAdmin({ searchParams }: PageProps<"/admin/clients">) {
  return (
    <main className="max-w-md space-y-8">
      <h1 className="font-serif text-3xl">Clients</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>{searchParams.then((p) => <Body q={String(p.q ?? "")} />)}</Suspense>
    </main>
  );
}

async function Body({ q }: { q: string }) {
  const actor = await requirePage(["admin"]);
  const db = await getDb();
  const [rows, shop] = await Promise.all([listClients(db, actor, q), getSettings()]);
  return (
    <>
      <form role="search" className="flex gap-2">
        <label className="flex-1 text-sm">
          <span className="sr-only">Search by name or phone</span>
          <input name="q" type="search" defaultValue={q} placeholder="Search by name or phone" className="block min-h-11 w-full rounded-md border border-line bg-surface px-3" />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm">
          Search
        </button>
      </form>
      <section aria-labelledby="list" className="space-y-3">
        <h2 id="list" className="font-serif text-xl">
          {q ? `Results for "${q}"` : "All clients"} ({rows.length})
        </h2>
        {rows.length === 0 && <p className="text-muted">No clients found.</p>}
        <ul className="divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clients/${c.id}`} className="block min-h-11 py-2 text-sm">
                <span className="font-medium">{c.name}</span> <span className="text-muted">{c.phone}</span>
                <span className="block text-muted">
                  {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}
                  {c.lastVisit ? `, last visit ${inZone(c.lastVisit, shop.timezone, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className="font-serif text-xl">
          Add a client
        </h2>
        <AdminForm action={saveClientAction} submit="Add client">
          <ClientFields />
        </AdminForm>
      </section>
    </>
  );
}
