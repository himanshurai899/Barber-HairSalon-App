"use client";

import { useActionState, type ReactNode } from "react";

export type FormState = { error?: string; ok?: boolean } | null;

/** A form around a server action that shows its error or "Saved". */
export function AdminForm({
  action,
  children,
  submit = "Save",
  tone = "primary",
  done = "Saved.",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children?: ReactNode;
  submit?: string;
  tone?: "primary" | "quiet";
  done?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {children}
      {state?.error && (
        <p role="alert" className="text-warn">
          {state.error}
        </p>
      )}
      {state?.ok && <p role="status">{done}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-11 items-center rounded-md px-5 text-sm disabled:opacity-60 ${
          tone === "primary" ? "bg-ink text-bg" : "border border-line"
        }`}
      >
        {submit}
      </button>
    </form>
  );
}

export const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3";

export function Field({ label, name, defaultValue, type = "text", hint, required, list }: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
  required?: boolean;
  list?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} list={list} step={type === "number" ? "any" : undefined} className={field} />
      {hint && <span className="text-muted">{hint}</span>}
    </label>
  );
}
