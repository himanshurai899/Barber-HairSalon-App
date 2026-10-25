import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAvailableSlots } from "@/lib/booking-service";
import { getDb } from "@/lib/db";
import { inZone, money, todayIn } from "@/lib/format";
import { getBarbersForService, getServices, getSettings } from "@/lib/shop";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Book a slot", description: "Request an appointment at Krishna Hair Salon." };

// Step state lives in the URL (ids and times only, never name or phone) so the back button works.
type Params = { service?: string; barber?: string; date?: string; t?: string };

export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <h1 className="font-serif text-3xl">Book a slot</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        {searchParams.then((p) => (
          <Flow p={p as Params} />
        ))}
      </Suspense>
    </main>
  );
}

const chip = "inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-4";
const href = (p: Params) => `/book?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`;

function Back({ to, label }: { to: Params; label: string }) {
  return (
    <Link href={href(to)} className="inline-flex min-h-11 items-center text-sm text-accent underline">
      {label}
    </Link>
  );
}

async function Flow({ p }: { p: Params }) {
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  const service = services.find((x) => String(x.id) === p.service);

  if (!service) {
    return (
      <section aria-labelledby="step" className="space-y-3">
        <h2 id="step" className="font-medium">
          1. Choose a service
        </h2>
        <ul className="space-y-2">
          {services.map((x) => (
            <li key={x.id}>
              <Link href={href({ service: String(x.id) })} className={`${chip} w-full justify-between`}>
                <span>
                  {x.name} <span className="text-sm text-muted">{x.durationMin} min</span>
                </span>
                <span>{money(x.priceMinor, settings.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const barbers = await getBarbersForService(service.id);
  const barber = p.barber === "any" ? "any" : barbers.find((b) => String(b.id) === p.barber);
  if (!barber) {
    return (
      <section aria-labelledby="step" className="space-y-3">
        <Back to={{}} label="Back" />
        <h2 id="step" className="font-medium">
          2. Choose a barber
        </h2>
        <ul className="space-y-2">
          <li>
            <Link href={href({ service: p.service, barber: "any" })} className={`${chip} w-full`}>
              Any available
            </Link>
          </li>
          {barbers.map((b) => (
            <li key={b.id}>
              <Link href={href({ service: p.service, barber: String(b.id) })} className={`${chip} w-full`}>
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const tz = settings.timezone;
  const today = todayIn(tz);
  const days = Array.from({ length: Math.min(14, settings.horizonDays) }, (_, i) =>
    new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );
  const date = p.date && days.includes(p.date) ? p.date : days[0];
  const slots = (await getAvailableSlots(await getDb(), { serviceId: service.id, date })).filter(
    (s) => barber === "any" || s.barberIds.includes(barber.id),
  );
  const timeOf = (d: Date) => inZone(d, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const barberName = barber === "any" ? "Any available" : barber.name;
  const base = { service: p.service, barber: p.barber };
  const picked = slots.find((s) => timeOf(s.start) === p.t);

  if (picked && p.t) {
    return (
      <section aria-labelledby="step" className="space-y-4">
        <Back to={{ ...base, date }} label="Change time" />
        <h2 id="step" className="font-medium">
          4. Your details
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-line bg-surface p-4 text-sm">
          <dt className="text-muted">Service</dt>
          <dd>{service.name}</dd>
          <dt className="text-muted">Barber</dt>
          <dd>{barberName}</dd>
          <dt className="text-muted">When</dt>
          <dd>{inZone(picked.start, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</dd>
          <dt className="text-muted">Price</dt>
          <dd>{money(service.priceMinor, settings.currency)}</dd>
        </dl>
        <BookingForm service={service.id} barber={String(p.barber)} date={date} time={p.t} />
      </section>
    );
  }

  return (
    <section aria-labelledby="step" className="space-y-4">
      <Back to={{ service: p.service }} label="Change barber" />
      <h2 id="step" className="font-medium">
        3. Pick a day and time
      </h2>
      <nav aria-label="Day" className="flex flex-wrap gap-2">
        {days.map((d) => (
          <Link
            key={d}
            href={href({ ...base, date: d })}
            aria-current={d === date ? "true" : undefined}
            className={`${chip} ${d === date ? "border-ink bg-ink text-bg" : ""}`}
          >
            {inZone(new Date(`${d}T12:00:00Z`), "UTC", { weekday: "short", day: "numeric", month: "short" })}
          </Link>
        ))}
      </nav>
      {slots.length ? (
        <ul className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <li key={s.start.toISOString()}>
              <Link href={href({ ...base, date, t: timeOf(s.start) })} className={chip}>
                {inZone(s.start, tz, { hour: "numeric", minute: "2-digit", hour12: true })}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No times left on this day. Try another day.</p>
      )}
    </section>
  );
}
