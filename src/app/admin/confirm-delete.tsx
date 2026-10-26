import Link from "next/link";
import type { ReactNode } from "react";
import { AdminForm, type FormState } from "./admin-form";

/** The confirm step for every hard delete: a real page, works without JS beyond the form itself. */
export function ConfirmDelete({ title, children, action, id, back }: {
  title: string;
  children?: ReactNode;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  id: number | string;
  back: string;
}) {
  return (
    <main className="max-w-md space-y-4">
      <h1 className="font-serif text-3xl">{title}</h1>
      {children}
      <AdminForm action={action} submit="Yes, delete permanently" done="Deleted.">
        <input type="hidden" name="id" value={id} />
      </AdminForm>
      <Link href={back} className="inline-flex min-h-11 items-center underline">
        Back to the list
      </Link>
    </main>
  );
}
