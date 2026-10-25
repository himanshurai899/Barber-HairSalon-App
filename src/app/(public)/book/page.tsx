import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAvailableSlots } from "@/lib/booking-service";
import { getDb } from "@/lib/db";
import { duration, inZone, money, selectionSummary, todayIn } from "@/lib/format";
import { getBarbersForServices, getServices, getSettings } from "@/lib/shop";
import { BookingForm } from "./booking-form";
import { ServicePicker } from "./service-picker";

export const metadata: Metadata = { title: "Book a slot", description: "Request an appointment at Krishna Hair Salon." };

// Step state lives in the URL (ids and times only, never name or phone) so the back button works.
type Params = { service?: string | string[]; edit?: string; barber?: string; date?: string; t?: string; src?: string };

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
const href = (p: Params) => `/book?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`; // our links only ever carry strings

function Back({ to, label }: { to: Params; label: string }) {
  return (
    <Link href={href(to)} className="inline-flex min-h-11 items-center text-sm text-accent underline">
      {label}
    </Link>
  );
}

async function Flow({ p }: { p: Params }) {
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  // ?service=1,3 (our links) or ?service=1&service=3 (the step 1 form); anything unknown or inactive sends you back to step 1.
  const asked = [...new Set([p.service ?? []].flat().flatMap((v) => v.split(",")).filter(Boolean))];
  const picked = services.filter((x) => asked.includes(String(x.id)));
  const valid = picked.length > 0 && picked.length === asked.length;
  const svc = picked.map((x) => x.id).join(","); // canonical, in shop order
  const cur = settings.currency;

  if (!valid || p.edit) {
    return (
      <section aria-labelledby="step" className="space-y-3">
        <h2 id="step" className="font-medium">
          1. Choose services
        </h2>
        <p className="text-sm text-muted">Pick one or more. They are done together in one visit.</p>
        <ServicePicker services={services} currency={cur} src={p.src} selected={valid ? picked.map((x) => x.id) : []} />
      </section>
    );
  }

  const ids = picked.map((x) => x.id);
  const total = picked.reduce((n, x) => n + x.priceMinor, 0);
  const barbers = await getBarbersForServices(ids);
  const barber = p.barber === "any" ? "any" : barbers.find((b) => String(b.id) === p.barber);
  if (!barber) {
    return (
      <section aria-labelledby="step" className="space-y-3">
        <Back to={{ service: svc, edit: "1", src: p.src }} label="Change services" />
        <h2 id="step" className="font-medium">
          2. Choose a barber
        </h2>
        <p className="text-sm text-muted">{selectionSummary(picked, cur)}</p>
        {barbers.length === 0 ? (
          <p className="text-muted">No single barber does all of these. Please change your services or call us.</p>
        ) : (
          <ul className="space-y-2">
            <li>
              <Link href={href({ service: svc, barber: "any", src: p.src })} className={`${chip} w-full`}>
                Any available
              </Link>
            </li>
            {barbers.map((b) => (
              <li key={b.id}>
                <Link href={href({ service: svc, barber: String(b.id), src: p.src })} className={`${chip} w-full`}>
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const tz = settings.timezone;
  const today = todayIn(tz);
  const days = Array.from({ length: Math.min(14, settings.horizonDays) }, (_, i) =>
    new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );
  const date = p.date && days.includes(p.date) ? p.date : days[0];
  const slots = (await getAvailableSlots(await getDb(), { serviceIds: ids, date })).filter(
    (s) => barber === "any" || s.barberIds.includes(barber.id),
  );
  const timeOf = (d: Date) => inZone(d, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const barberName = barber === "any" ? "Any available" : barber.name;
  const base = { service: svc, barber: p.barber, src: p.src };
  const chosen = slots.find((s) => timeOf(s.start) === p.t);

  if (chosen && p.t) {
    return (
      <section aria-labelledby="step" className="space-y-4">
        <Back to={{ ...base, date }} label="Change time" />
        <h2 id="step" className="font-medium">
          4. Your details
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-line bg-surface p-4 text-sm">
          <dt className="text-muted">{picked.length > 1 ? "Services" : "Service"}</dt>
          <dd>{picked.map((x) => x.name).join(" + ")}</dd>
          <dt className="text-muted">Time needed</dt>
          <dd>{duration(picked.reduce((n, x) => n + x.durationMin, 0))}</dd>
          <dt className="text-muted">Barber</dt>
          <dd>{barberName}</dd>
          <dt className="text-muted">When</dt>
          <dd>{inZone(chosen.start, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</dd>
          {total > 0 && (
            <>
              <dt className="text-muted">Price</dt>
              <dd>{money(total, cur)}</dd>
            </>
          )}
        </dl>
        <BookingForm services={svc} barber={String(p.barber)} date={date} time={p.t} source={p.src === "wa" ? "whatsapp" : "web"} />
      </section>
    );
  }

  return (
    <section aria-labelledby="step" className="space-y-4">
      <Back to={{ service: svc, src: p.src }} label="Change barber" />
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
