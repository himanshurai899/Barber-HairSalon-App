import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClient } from "@/lib/clients";
import { getDb } from "@/lib/db";
import { inZone, money } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/shop";
import { AdminForm } from "../../admin-form";
import { saveClientAction } from "../../actions";
import { ClientFields } from "../client-fields";

export const metadata: Metadata = { title: "Client", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/clients/[id]">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  const actor = await requirePage(["admin"]);
  const [c, shop] = await Promise.all([Number.isInteger(id) ? getClient(await getDb(), actor, id) : null, getSettings()]);
  if (!c) notFound();
  const day = (d: Date | null) => (d ? inZone(d, shop.timezone, { day: "numeric", month: "short", year: "numeric" }) : "never");
  return (
    <main className="max-w-md space-y-8">
      <div>
        <Link href="/admin/clients" className="inline-flex min-h-11 items-center text-sm underline">
          All clients
        </Link>
        <h1 className="font-serif text-3xl">{c.name}</h1>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">First visit</dt>
        <dd>{day(c.firstVisit)}</dd>
        <dt className="text-muted">Last visit</dt>
        <dd>{day(c.lastVisit)}</dd>
        <dt className="text-muted">Bookings</dt>
        <dd>{c.bookingCount}</dd>
        <dt className="text-muted">Approved total</dt>
        <dd>{money(c.approvedTotalMinor, shop.currency)}</dd>
      </dl>
      <section aria-labelledby="details" className="space-y-3">
        <h2 id="details" className="font-serif text-xl">
          Details
        </h2>
        <AdminForm action={saveClientAction}>
          <ClientFields c={c} />
        </AdminForm>
      </section>
      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="font-serif text-xl">
          Booking history
        </h2>
        {c.history.length === 0 && <p className="text-muted">No bookings yet.</p>}
        <ul className="divide-y divide-line text-sm">
          {c.history.map((h) => (
            <li key={h.id}>
              <Link href={`/admin/bookings/${h.id}/edit`} className="block min-h-11 py-2">
                <span className="font-medium">{inZone(h.during.start, shop.timezone, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</span>{" "}
                <span className="text-muted">
                  {h.service} with {h.barber}, {h.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Link href={`/admin/clients/${c.id}/delete`} className="inline-flex min-h-11 items-center text-warn underline">
        Delete client
      </Link>
    </main>
  );
}
