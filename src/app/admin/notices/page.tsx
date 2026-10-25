import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { copyForWhatsApp } from "@/lib/admin-bookings";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { AdminForm, Field, field } from "../admin-form";
import { deleteNoticeAction, saveNoticeAction } from "../actions";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Notices and offers", robots: { index: false } };

function Fields({ n }: { n?: typeof s.notices.$inferSelect }) {
  return (
    <>
      {n && <input type="hidden" name="id" value={n.id} />}
      <label className="block text-sm">
        Type
        <select name="kind" defaultValue={n?.kind ?? "notice"} className={field}>
          <option value="notice">Notice (bar at the top)</option>
          <option value="offer">Offer (card)</option>
        </select>
      </label>
      <Field label="Title" name="title" defaultValue={n?.title} required />
      <Field label="Details" name="body" defaultValue={n?.body} />
      <Field label="Badge (offers)" name="badge" defaultValue={n?.badge} />
      <Field label="Show from" name="startsOn" type="date" defaultValue={n?.startsOn} />
      <Field label="Show until" name="endsOn" type="date" defaultValue={n?.endsOn} />
      <Field label="Sort order" name="sort" type="number" defaultValue={n?.sort ?? 0} />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={n ? n.active : true} className="size-5" />
        Active
      </label>
    </>
  );
}

export default async function NoticesAdmin() {
  const rows = await (await getDb()).select().from(s.notices).orderBy(asc(s.notices.sort), asc(s.notices.id));
  return (
    <main className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Notices and offers</h1>
      {rows.map((n) => (
        <details key={n.id} className="space-y-4 rounded-md border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer py-2">
            {n.title} {!n.active && <span className="text-muted">(off)</span>}
          </summary>
          <CopyButton text={copyForWhatsApp(n)} />
          <AdminForm action={saveNoticeAction}>
            <Fields n={n} />
          </AdminForm>
          <form action={deleteNoticeAction}>
            <input type="hidden" name="id" value={n.id} />
            <button className="inline-flex min-h-11 items-center text-warn underline">Delete</button>
          </form>
        </details>
      ))}
      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className="font-serif text-xl">
          Add one
        </h2>
        <AdminForm action={saveNoticeAction} submit="Add">
          <Fields />
        </AdminForm>
      </section>
    </main>
  );
}
