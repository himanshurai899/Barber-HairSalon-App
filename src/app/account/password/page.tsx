import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePage } from "@/lib/session";
import { AdminForm } from "../../admin/admin-form";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Change password", robots: { index: false } };

export default function PasswordPage() {
  return (
    <main className="max-w-md space-y-4">
      <h1 className="font-serif text-3xl">Change my password</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Body />
      </Suspense>
    </main>
  );
}

async function Body() {
  const actor = await requirePage(["admin", "barber"]);
  return (
    <>
      <p className="text-sm text-muted">After changing it you are signed out everywhere and sign in again with the new one.</p>
      <AdminForm action={changePasswordAction} submit="Change password" done="Password changed. Sign in again with the new one.">
        <PasswordField label="Current password" name="current" autoComplete="current-password" />
        <PasswordField label="New password (8 or more characters)" name="next" autoComplete="new-password" />
        <PasswordField label="New password again" name="confirm" autoComplete="new-password" />
      </AdminForm>
      <Link href={actor.role === "admin" ? "/admin" : "/staff"} className="inline-flex min-h-11 items-center text-sm underline">
        Back
      </Link>
    </>
  );
}

function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} type="password" required minLength={name === "current" ? undefined : 8} autoComplete={autoComplete} className="mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3" />
    </label>
  );
}
