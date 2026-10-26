import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getBookingFor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { inZone } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/shop";
import { deleteBookingAction } from "../../../actions";
import { ConfirmDelete } from "../../../confirm-delete";

export const metadata: Metadata = { title: "Delete booking", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/bookings/[id]/delete">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  const actor = await requirePage(["admin"]);
  const b = Number.isInteger(id) ? await getBookingFor(await getDb(), actor, id) : null;
  if (!b)
    return (
      <main className="max-w-md space-y-4">
        <p role="status">Deleted.</p>
        <Link href="/admin/bookings" className="inline-flex min-h-11 items-center underline">
          Back to the list
        </Link>
      </main>
    );
  const when = inZone(b.during.start, (await getSettings()).timezone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  return (
    <ConfirmDelete title="Delete booking?" action={deleteBookingAction} id={b.id} back="/admin/bookings">
      <p>
        Delete the {b.status} booking for <strong>{b.customer}</strong>, {b.service}, {when}, for good? To keep a record, set its status to cancelled instead.
      </p>
    </ConfirmDelete>
  );
}
