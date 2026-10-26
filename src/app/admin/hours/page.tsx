import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { dateRange, WEEKDAYS } from "@/lib/format";
import { AdminForm, Field } from "../admin-form";
import { addSpecialHoursAction, deleteSpecialHoursAction, saveShopHoursAction } from "../actions";

export const metadata: Metadata = { title: "Hours", robots: { index: false } };

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const t5 = (t: string) => t.slice(0, 5);

function SpecialFields({ h }: { h?: typeof s.specialHours.$inferSelect }) {
  return (
    <>
      <Field label="Label" name="label" defaultValue={h?.label} />
      <Field label="From date" name="startsOn" type="date" defaultValue={h?.startsOn} required />
      <Field label="To date" name="endsOn" type="date" defaultValue={h?.endsOn} required />
      <Field label="Opens" name="opens" type="time" defaultValue={h?.opens?.slice(0, 5)} />
      <Field label="Closes" name="closes" type="time" defaultValue={h?.closes?.slice(0, 5)} />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="closed" defaultChecked={h?.closed} className="size-5" />
        Closed on these dates
      </label>
    </>
  );
}

export default async function HoursAdmin() {
  const db = await getDb();
  const [weekly, special] = await Promise.all([
    db.select().from(s.shopHours),
    db.select().from(s.specialHours).orderBy(asc(s.specialHours.startsOn)),
  ]);
  const byDay = new Map(weekly.map((h) => [h.weekday, `${t5(h.opens)}-${t5(h.closes)}`]));
  return (
    <main className="max-w-md space-y-10">
      <h1 className="font-serif text-3xl">Hours</h1>
      <section aria-labelledby="weekly" className="space-y-3">
        <h2 id="weekly" className="font-serif text-xl">
          Weekly shop hours
        </h2>
        <AdminForm action={saveShopHoursAction}>
          {DAY_ORDER.map((d) => (
            <Field key={d} label={WEEKDAYS[d]} name={`day${d}`} defaultValue={byDay.get(d)} hint="Like 10:00-20:00. Leave empty if closed." />
          ))}
        </AdminForm>
      </section>
      <section aria-labelledby="special" className="space-y-3">
        <h2 id="special" className="font-serif text-xl">
          Special hours
        </h2>
        <p className="text-sm text-muted">Override the weekly hours for a date range, for example festival timings or a holiday.</p>
        <ul className="divide-y divide-line">
          {special.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <details className="flex-1">
                <summary className="min-h-11 cursor-pointer py-2">
                  {h.label || "Special hours"}, {dateRange(h.startsOn, h.endsOn)}:{" "}
                  {h.closed ? "closed" : `${t5(h.opens ?? "")} to ${t5(h.closes ?? "")}`}
                </summary>
                <AdminForm action={addSpecialHoursAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <SpecialFields h={h} />
                </AdminForm>
              </details>
              <form action={deleteSpecialHoursAction}>
                <input type="hidden" name="id" value={h.id} />
                <button className="inline-flex min-h-11 items-center px-2 text-warn underline">Delete</button>
              </form>
            </li>
          ))}
        </ul>
        <AdminForm action={addSpecialHoursAction} submit="Add special hours">
          <SpecialFields />
        </AdminForm>
      </section>
    </main>
  );
}
