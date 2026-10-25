"use client";

import { useActionState } from "react";
import { login } from "./actions";

const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        Email
        <input name="email" type="email" required autoComplete="username" className={field} />
      </label>
      <label className="block">
        Password
        <input name="password" type="password" required autoComplete="current-password" className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="text-warn">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-5 text-bg disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
