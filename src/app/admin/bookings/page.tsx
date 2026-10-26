import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listBookingsFor } from "@/lib/access";
import { listClients } from "@/lib/clients";
import { getDb } from "@/lib/db";
import { bookingStatuses } from "@/lib/db/schema";
import { inZone } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { getBarbers, getServices, getSettings } from "@/lib/shop";
import { AdminForm, Field, field } from "../admin-form";
import { manualBookingAction, overrideStatusAction } from "../actions";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };

export default function BookingsAdmin({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <main className="max-w-2xl space-y-10">
      <h1 className="font-serif text-3xl">Bookings</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>{searchParams.then((p) => <Body status={String(p.status ?? "")} />)}</Suspense>
    </main>
  );
}

async function Body({ status }: { status: string }) {
  const actor = await requirePage(["admin"]);
  const db = await getDb();
  const [all, services, barbers, shop, clients] = await Promise.all([listBookingsFor(db, actor), getServices(), getBarbers(), getSettings(), listClients(db, actor)]);
  const rows = (status ? all.filter((b) => b.status === status) : all).sort((a, b) => b.during.start.getTime() - a.during.start.getTime()).slice(0, 200);
  const tz = shop.timezone;
  return (
    <>
      <section aria-labelledby="manual" className="max-w-md space-y-3">
        <h2 id="manual" className="font-serif text-xl">
          Phone or walk-in booking
        </h2>
        <p className="text-sm text-muted">Saved as approved straight away.</p>
        <AdminForm action={manualBookingAction} submit="Add booking">
          <label className="block text-sm">
            Source
            <select name="source" className={field}>
              <option value="phone">Phone call</option>
              <option value="walk_in">Walk-in</option>
              <option value="admin">Other</option>
            </select>
          </label>
          <fieldset className="space-y-1 text-sm">
            <legend>Services (tick one or more)</legend>
            {services.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="serviceIds" value={s.id} className="size-5" />
                {s.name} ({s.durationMin} min)
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            Barber
            <select name="barberId" required className={field}>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Date" name="date" type="date" required />
          <Field label="Time" name="time" type="time" required />
          <Field label="Customer name" name="name" required />
          <Field label="Phone" name="phone" type="tel" list="clients" required />
          <datalist id="clients">
            {clients.slice(0, 500).map((c) => (
              <option key={c.id} value={c.phone} label={c.name} />
            ))}
          </datalist>
          <Field label="Note (optional)" name="note" />
        </AdminForm>
      </section>

      <section aria-labelledby="all" className="space-y-3">
        <h2 id="all" className="font-serif text-xl">
          All bookings
        </h2>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
          {["", ...bookingStatuses].map((st) => (
            <Link
              key={st}
              href={st ? `/admin/bookings?status=${st}` : "/admin/bookings"}
              aria-current={st === status ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md border border-line px-3 capitalize ${st === status ? "bg-ink text-bg" : ""}`}
            >
              {st || "all"}
            </Link>
          ))}
        </nav>
        {rows.length === 0 && <p className="text-muted">No bookings.</p>}
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id} className="rounded-md border border-line bg-surface p-3 text-sm">
              <p className="font-medium">
                {inZone(b.during.start, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}, {b.customer}
              </p>
              <p className="text-muted">
                {b.service} with {b.barber}, {b.customerPhone}, from {b.source}
              </p>
              <p className="flex gap-4">
                <Link href={`/admin/bookings/${b.id}/edit`} className="inline-flex min-h-11 items-center underline">
                  Edit
                </Link>
                <Link href={`/admin/bookings/${b.id}/delete`} className="inline-flex min-h-11 items-center text-warn underline">
                  Delete
                </Link>
              </p>
              <AdminForm action={overrideStatusAction} submit="Set status" tone="quiet">
                <input type="hidden" name="id" value={b.id} />
                <select name="status" defaultValue={b.status} aria-label={`Status for ${b.customer}`} className={field}>
                  {bookingStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </AdminForm>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
