import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requirePage } from "@/lib/session";
import { deleteLoginAction } from "../../actions";
import { ConfirmDelete } from "../../../confirm-delete";

export const metadata: Metadata = { title: "Delete login", robots: { index: false } };

export default function Page({ params }: PageProps<"/admin/users/[id]/delete">) {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Body id={p.id} />)}</Suspense>;
}

async function Body({ id }: { id: string }) {
  await requirePage(["admin"]);
  const [row] = await (await getDb()).select().from(s.user).where(eq(s.user.id, id));
  if (!row)
    return (
      <main className="max-w-md space-y-4">
        <p role="status">Deleted.</p>
        <Link href="/admin/users" className="inline-flex min-h-11 items-center underline">
          Back to the list
        </Link>
      </main>
    );
  return (
    <ConfirmDelete title="Delete login?" action={deleteLoginAction} id={row.id} back="/admin/users">
      <p>
        Delete the login for <strong>{row.name}</strong> ({row.email}) for good? They are signed out and can no longer sign in. Their barber profile and bookings stay. You cannot delete yourself or the last admin.
      </p>
    </ConfirmDelete>
  );
}
