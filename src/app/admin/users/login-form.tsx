"use client";

import { useActionState } from "react";
import { createLogin } from "./actions";

const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3";

export function CreateLoginForm({ barbers }: { barbers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(createLogin, null);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <label className="block">
        Name
        <input name="name" required className={field} />
      </label>
      <label className="block">
        Email
        <input name="email" type="email" required className={field} />
      </label>
      <label className="block">
        Temporary password
        <input name="password" type="text" required minLength={8} autoComplete="off" className={field} />
      </label>
      <label className="block">
        Role
        <select name="role" defaultValue="barber" className={field}>
          <option value="barber">Barber</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="block">
        Barber profile
        <select name="barberId" defaultValue="" className={field}>
          <option value="">None</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {state?.error && (
        <p role="alert" className="text-warn">
          {state.error}
        </p>
      )}
      {state?.ok && <p role="status">Login created.</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-bg disabled:opacity-60"
      >
        Create login
      </button>
    </form>
  );
}
