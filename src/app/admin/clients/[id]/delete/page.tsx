import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { deleteClientAction } from "../../../actions";
import { ConfirmDelete } from "../../../confirm-delete";

export const metadata: Metadata = { title: "Delete client", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/clients/[id]/delete">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={Number(p.id)} />)}</Suspense>;
}

async function Body({ id }: { id: number }) {
  await requirePage(["admin"]);
  const [row] = Number.isInteger(id) ? await (await getDb()).select().from(s.customers).where(eq(s.customers.id, id)) : [];
  if (!row)
    return (
      <main className="max-w-md space-y-4">
        <p role="status">Deleted.</p>
        <Link href="/admin/clients" className="inline-flex min-h-11 items-center underline">
          Back to the list
        </Link>
      </main>
    );
  return (
    <ConfirmDelete title="Delete client?" action={deleteClientAction} id={row.id} back={`/admin/clients/${row.id}`}>
      <p>
        Delete <strong>{row.name}</strong> ({row.phone}) for good? A client with bookings cannot be deleted, their history is kept.
      </p>
    </ConfirmDelete>
  );
}
