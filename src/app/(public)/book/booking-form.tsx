"use client";

import { useActionState } from "react";
import { submitBooking } from "./actions";

const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-surface px-3";

export function BookingForm(props: { services: string; barber: string; date: string; time: string; source: string }) {
  const [state, action, pending] = useActionState(submitBooking, null);
  return (
    <form action={action} className="space-y-4">
      {(["services", "barber", "date", "time", "source"] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={props[k]} />
      ))}
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="block">
        Your name
        <input name="name" required maxLength={80} autoComplete="name" defaultValue={state?.name} className={field} />
      </label>
      <label className="block">
        Phone number
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          defaultValue={state?.phone}
          className={field}
        />
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="waOptIn" defaultChecked className="size-5" />
        Send updates on WhatsApp
      </label>
      {state?.error && (
        <p role="alert" className="text-warn">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-5 text-bg disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request booking"}
      </button>
      <p className="text-sm text-muted">The barber confirms your request. We will message you on WhatsApp.</p>
    </form>
  );
}
