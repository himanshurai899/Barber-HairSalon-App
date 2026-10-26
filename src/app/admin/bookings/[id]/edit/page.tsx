import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBookingFor } from "@/lib/access";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/shop";
import { AdminForm, Field, field } from "../../../admin-form";
import { editBookingAction } from "../../../actions";

export const metadata: Metadata = { title: "Edit booking", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/bookings/[id]/edit">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  const actor = await requirePage(["admin"]);
  const db = await getDb();
  const b = Number.isInteger(id) ? await getBookingFor(db, actor, id) : null;
  if (!b) notFound();
  const [services, barbers, [full], shop] = await Promise.all([
    db.select().from(s.services).orderBy(asc(s.services.sort), asc(s.services.id)),
    db.select().from(s.barbers).orderBy(asc(s.barbers.sort), asc(s.barbers.id)),
    db.select({ serviceIds: s.bookings.serviceId, phone: s.customers.phone }).from(s.bookings).innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId)).where(eq(s.bookings.id, id)),
    getSettings(),
  ]);
  const lines = await db.select({ serviceId: s.bookingServices.serviceId }).from(s.bookingServices).where(eq(s.bookingServices.bookingId, id));
  const picked = new Set(lines.length ? lines.map((l) => l.serviceId) : [full.serviceIds]);
  const tz = shop.timezone;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(b.during.start);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(b.during.start);
  return (
    <main className="max-w-md space-y-4">
      <h1 className="font-serif text-3xl">Edit booking</h1>
      <p className="text-sm text-muted">
        Status: {b.status}. Changing the time, barber or services checks the barber&apos;s free slots. Price and length are kept unless the services change.
      </p>
      <AdminForm action={editBookingAction}>
        <input type="hidden" name="id" value={b.id} />
        <fieldset className="space-y-1 text-sm">
          <legend>Services</legend>
          {services.map((v) => (
            <label key={v.id} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="serviceIds" value={v.id} defaultChecked={picked.has(v.id)} className="size-5" />
              {v.name} ({v.durationMin} min)
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          Barber
          <select name="barberId" defaultValue={b.barberId} className={field}>
            {barbers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Date" name="date" type="date" defaultValue={date} required />
        <Field label="Time" name="time" type="time" defaultValue={time} required />
        <Field label="Customer name" name="name" defaultValue={b.customer} required />
        <Field label="Phone" name="phone" type="tel" defaultValue={full.phone} hint="A different number moves the booking to that client." required />
        <Field label="Note (optional)" name="note" defaultValue={b.note} />
      </AdminForm>
      <p className="flex gap-4 text-sm">
        <Link href="/admin/bookings" className="inline-flex min-h-11 items-center underline">
          Back to bookings
        </Link>
        <Link href={`/admin/bookings/${b.id}/delete`} className="inline-flex min-h-11 items-center text-warn underline">
          Delete booking
        </Link>
      </p>
    </main>
  );
}
