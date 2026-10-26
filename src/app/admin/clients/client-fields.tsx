import type { customers } from "@/lib/db/schema";
import { Field } from "../admin-form";

/** Shared by "Add client" and the client detail page. */
export function ClientFields({ c }: { c?: typeof customers.$inferSelect }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name" name="name" defaultValue={c?.name} required />
      <Field label="Phone" name="phone" type="tel" defaultValue={c?.phone} hint="One client per number, any way of writing it." required />
      <Field label="Email (optional)" name="email" type="email" defaultValue={c?.email} />
      <label className="block text-sm">
        Notes (only you see these)
        <textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} maxLength={1000} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="waOptIn" defaultChecked={c?.waOptIn} className="size-5" />
        Send WhatsApp updates
      </label>
    </>
  );
}
