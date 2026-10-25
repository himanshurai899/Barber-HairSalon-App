import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { dateRange, inZone, WEEKDAYS } from "@/lib/format";
import { getSettings } from "@/lib/shop";
import { AdminForm, Field } from "../admin-form";
import { addTimeOffAction, deleteTimeOffAction, saveAvailabilityAction, saveBarberAction } from "../actions";

export const metadata: Metadata = { title: "Barbers", robots: { index: false } };

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const t5 = (t: string) => t.slice(0, 5);

function ProfileFields({ b, services, offered }: { b?: typeof s.barbers.$inferSelect; services: { id: number; name: string }[]; offered: Set<number> }) {
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Name" name="name" defaultValue={b?.name} required />
      <Field label="Phone (for WhatsApp alerts, with country code)" name="phone" type="tel" defaultValue={b?.phone} />
      <Field label="Photo link" name="photoUrl" type="url" defaultValue={b?.photoUrl} />
      <Field label="Instagram handle" name="instagram" defaultValue={b?.instagram} />
      <Field label="Short bio" name="bio" defaultValue={b?.bio} />
      <Field label="Sort order" name="sort" type="number" defaultValue={b?.sort ?? 0} />
      <fieldset className="space-y-1">
        <legend className="text-sm">Services offered</legend>
        {services.map((sv) => (
          <label key={sv.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="serviceIds" value={sv.id} defaultChecked={offered.has(sv.id)} className="size-5" />
            {sv.name}
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={b ? b.active : true} className="size-5" />
        Active (bookable and shown on the website)
      </label>
    </>
  );
}

export default async function BarbersAdmin() {
  const db = await getDb();
  const [barbers, services, links, avail, off, shop] = await Promise.all([
    db.select().from(s.barbers).orderBy(asc(s.barbers.sort), asc(s.barbers.id)),
    db.select({ id: s.services.id, name: s.services.name }).from(s.services).orderBy(asc(s.services.sort)),
    db.select().from(s.barberServices),
    db.select().from(s.availability).orderBy(asc(s.availability.startTime)),
    db.select().from(s.timeOff).orderBy(asc(s.timeOff.id)),
    getSettings(),
  ]);
  return (
    <main className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Barbers</h1>
      {barbers.map((b) => {
        const offered = new Set(links.filter((l) => l.barberId === b.id).map((l) => l.serviceId));
        const mine = avail.filter((a) => a.barberId === b.id);
        return (
          <details key={b.id} className="space-y-6 rounded-md border border-line bg-surface p-4">
            <summary className="min-h-11 cursor-pointer py-2">
              {b.name} {!b.active && <span className="text-muted">(inactive)</span>}
            </summary>
            <AdminForm action={saveBarberAction}>
              <ProfileFields b={b} services={services} offered={offered} />
            </AdminForm>
            <section aria-label={`Weekly availability for ${b.name}`} className="space-y-2">
              <h2 className="font-medium">Weekly availability</h2>
              <p className="text-sm text-muted">Working windows, clipped to shop hours. Use several windows for a break, like 10:00-13:30, 14:30-20:00.</p>
              <AdminForm action={saveAvailabilityAction}>
                <input type="hidden" name="barberId" value={b.id} />
                {ORDER.map((d) => (
                  <Field
                    key={d}
                    label={WEEKDAYS[d]}
                    name={`day${d}`}
                    defaultValue={mine.filter((a) => a.weekday === d).map((a) => `${t5(a.startTime)}-${t5(a.endTime)}`).join(", ")}
                  />
                ))}
              </AdminForm>
            </section>
            <section aria-label={`Time off for ${b.name}`} className="space-y-2">
              <h2 className="font-medium">Time off</h2>
              <p className="text-sm text-muted">Hides only this barber&apos;s slots. Other barbers stay bookable.</p>
              <ul className="divide-y divide-line">
                {off
                  .filter((o) => o.barberId === b.id)
                  .map((o) => {
                    const f = (d: Date) => inZone(d, shop.timezone, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          {dateRange(f(o.during.start), f(new Date(o.during.end.getTime() - 1)))} {o.reason && <span className="text-muted">{o.reason}</span>}
                        </span>
                        <form action={deleteTimeOffAction}>
                          <input type="hidden" name="id" value={o.id} />
                          <button className="inline-flex min-h-11 items-center px-2 text-warn underline">Delete</button>
                        </form>
                      </li>
                    );
                  })}
              </ul>
              <AdminForm action={addTimeOffAction} submit="Add time off">
                <input type="hidden" name="barberId" value={b.id} />
                <Field label="First day" name="from" type="date" required />
                <Field label="Last day" name="to" type="date" required />
                <Field label="Reason (optional)" name="reason" />
              </AdminForm>
            </section>
          </details>
        );
      })}
      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className="font-serif text-xl">
          Add a barber
        </h2>
        <AdminForm action={saveBarberAction} submit="Add barber">
          <ProfileFields services={services} offered={new Set()} />
        </AdminForm>
      </section>
    </main>
  );
}
