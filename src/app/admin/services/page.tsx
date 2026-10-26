import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { money } from "@/lib/format";
import * as s from "@/lib/db/schema";
import { AdminForm, Field } from "../admin-form";
import { saveServiceAction } from "../actions";

export const metadata: Metadata = { title: "Services", robots: { index: false } };

function Fields({ v }: { v?: typeof s.services.$inferSelect }) {
  return (
    <>
      {v && <input type="hidden" name="id" value={v.id} />}
      <Field label="Name" name="name" defaultValue={v?.name} required />
      <Field label="Category" name="category" defaultValue={v?.category ?? "Hair"} />
      <Field label="Duration (minutes)" name="durationMin" type="number" defaultValue={v?.durationMin} required />
      <Field label="Price (rupees)" name="price" type="number" defaultValue={v ? v.priceMinor / 100 : undefined} required />
      <Field label="Sort order" name="sort" type="number" defaultValue={v?.sort ?? 0} />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={v ? v.active : true} className="size-5" />
        Shown on the website
      </label>
    </>
  );
}

export default async function ServicesAdmin() {
  const rows = await (await getDb()).select().from(s.services).orderBy(asc(s.services.sort), asc(s.services.id));
  const groups = Map.groupBy(rows, (v) => v.category);
  const shown = rows.filter((v) => v.active).length;
  return (
    <main className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Services</h1>
      <p className="text-sm text-muted">
        {shown} shown on the website, {rows.length - shown} hidden. A service needs a price and a barber before customers can book it.
      </p>
      {[...groups].map(([category, items]) => (
        <section key={category} aria-label={category} className="space-y-2">
          <h2 className="font-serif text-xl">{category}</h2>
          {items.map((v) => (
            <details key={v.id} className="rounded-md border border-line bg-surface px-4">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2">
                <span>
                  {v.name}
                  <span className="block text-sm text-muted">
                    {v.durationMin} min · {v.priceMinor ? money(v.priceMinor, "INR") : "no price"}
                  </span>
                </span>
                <span className={`shrink-0 rounded-md border border-line px-2 text-xs ${v.active ? "text-ok" : "text-muted"}`}>
                  {v.active ? "Shown" : "Hidden"}
                </span>
              </summary>
              <AdminForm action={saveServiceAction}>
                <Fields v={v} />
              </AdminForm>
              <Link href={`/admin/services/${v.id}/delete`} className="mb-3 mt-2 inline-flex min-h-11 items-center text-warn underline">
                Delete service
              </Link>
            </details>
          ))}
        </section>
      ))}
      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className="font-serif text-xl">
          Add a service
        </h2>
        <AdminForm action={saveServiceAction} submit="Add service">
          <Fields />
        </AdminForm>
      </section>
    </main>
  );
}
