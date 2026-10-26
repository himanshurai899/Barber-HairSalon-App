import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { deleteServiceAction } from "../../../actions";
import { ConfirmDelete } from "../../../confirm-delete";

export const metadata: Metadata = { title: "Delete service", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/services/[id]/delete">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  await requirePage(["admin"]);
  const [row] = Number.isInteger(id) ? await (await getDb()).select().from(s.services).where(eq(s.services.id, id)) : [];
  if (!row)
    return (
      <main className="max-w-md space-y-4">
        <p role="status">Deleted.</p>
        <Link href="/admin/services" className="inline-flex min-h-11 items-center underline">
          Back to the list
        </Link>
      </main>
    );
  return (
    <ConfirmDelete title="Delete service?" action={deleteServiceAction} id={row.id} back="/admin/services">
      <p>
        Delete <strong>{row.name}</strong> for good? It is removed from every barber&apos;s list. If it has bookings the delete is refused: hide it instead.
      </p>
    </ConfirmDelete>
  );
}
