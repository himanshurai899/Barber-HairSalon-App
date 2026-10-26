import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { deleteBarberAction } from "../../../actions";
import { ConfirmDelete } from "../../../confirm-delete";

export const metadata: Metadata = { title: "Delete barber", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/barbers/[id]/delete">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  await requirePage(["admin"]);
  const [row] = Number.isInteger(id) ? await (await getDb()).select().from(s.barbers).where(eq(s.barbers.id, id)) : [];
  if (!row)
    return (
      <main className="max-w-md space-y-4">
        <p role="status">Deleted.</p>
        <Link href="/admin/barbers" className="inline-flex min-h-11 items-center underline">
          Back to the list
        </Link>
      </main>
    );
  return (
    <ConfirmDelete title="Delete barber?" action={deleteBarberAction} id={row.id} back="/admin/barbers">
      <p>
        Delete <strong>{row.name}</strong> for good? Their weekly availability, time off and service list are deleted too. If they have bookings the delete is refused: make them inactive instead.
      </p>
    </ConfirmDelete>
  );
}
