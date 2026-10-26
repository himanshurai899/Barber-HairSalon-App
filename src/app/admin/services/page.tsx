import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/lib/db";
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
  return (
    <main className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Services</h1>
      {rows.map((v) => (
        <details key={v.id} className="rounded-md border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer py-2">
            {v.name} {!v.active && <span className="text-muted">(hidden)</span>}
          </summary>
          <AdminForm action={saveServiceAction}>
            <Fields v={v} />
          </AdminForm>
          <Link href={`/admin/services/${v.id}/delete`} className="mt-2 inline-flex min-h-11 items-center text-warn underline">
            Delete service
          </Link>
        </details>
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
