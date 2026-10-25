import type { Metadata } from "next";
import { listBookingsFor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { inZone, money } from "@/lib/format";
import { requirePage } from "@/lib/session";
import { getSchedule } from "@/lib/staff-service";
import { getSettings } from "@/lib/shop";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Requests", robots: { index: false } };

const when = (d: Date, tz: string) =>
  inZone(d, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export default async function StaffHome() {
  const actor = await requirePage(["barber", "admin"]);
  const db = await getDb();
  const [pending, schedule, shop] = await Promise.all([
    listBookingsFor(db, actor, ["pending"]),
    getSchedule(db, actor),
    getSettings(),
  ]);
  const tz = shop.timezone;
  const today = inZone(new Date(), tz, { day: "numeric", month: "short" });

  return (
    <main className="space-y-10">
      <section aria-labelledby="pending" className="space-y-3">
        <h1 id="pending" className="font-serif text-3xl">
          Requests
        </h1>
        {pending.length === 0 && <p className="text-muted">No requests waiting.</p>}
        <ul className="space-y-3">
          {pending.map((b) => (
            <li key={b.id} className="rounded-md border border-line bg-surface p-4">
              <p className="font-medium">{b.customer}</p>
              <p className="text-sm text-muted">
                {b.service} with {b.barber}, {when(b.during.start, tz)}, {money(b.priceMinor, shop.currency)}
              </p>
              <p className="text-sm text-muted">{b.customerPhone}</p>
              <form action={decide} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <label className="block text-sm">
                  Reason if declining (optional)
                  <input
                    name="reason"
                    maxLength={200}
                    className="mt-1 block min-h-11 w-full rounded-md border border-line bg-bg px-3"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    name="decision"
                    value="approved"
                    className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm text-bg"
                  >
                    Approve
                  </button>
                  <button
                    name="decision"
                    value="rejected"
                    className="inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm"
                  >
                    Decline
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="schedule" className="space-y-3">
        <h2 id="schedule" className="font-serif text-2xl">
          Schedule
        </h2>
        {schedule.length === 0 && <p className="text-muted">Nothing booked yet.</p>}
        <ul className="divide-y divide-line">
          {schedule.map((b) => (
            <li key={b.id} className="py-3 text-sm">
              <span className="font-medium">
                {when(b.during.start, tz)}
                {inZone(b.during.start, tz, { day: "numeric", month: "short" }) === today && " (today)"}
              </span>{" "}
              {b.customer}, {b.service}
              {actor.role === "admin" && <span className="text-muted"> with {b.barber}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
