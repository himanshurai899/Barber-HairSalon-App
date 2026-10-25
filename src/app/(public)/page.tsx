import Link from "next/link";
import { Suspense } from "react";
import { clock, dateRange, digits, inZone, mapsDirectionsUrl, WEEKDAYS } from "@/lib/format";
import { getBarbers, getHours, getNotices, getSettings, getUpcomingTimeOff } from "@/lib/shop";
import { ShareLocation } from "./share-location";

const btn = "inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm";
const primary = `${btn} bg-ink text-bg`;
const secondary = `${btn} border border-line bg-surface`;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Landing />
      </Suspense>
    </main>
  );
}

async function Landing() {
  const [s, notices, timeOff, barbers, hours] = await Promise.all([
    getSettings(),
    getNotices(),
    getUpcomingTimeOff(),
    getBarbers(),
    getHours(),
  ]);
  const tz = s.timezone;
  const alerts = [
    ...notices.filter((n) => n.kind === "notice").map((n) => n.title),
    ...timeOff.map((t) => {
      const last = new Date(t.during.end.getTime() - 1);
      const from = inZone(t.during.start, tz, { day: "numeric", month: "short" });
      const to = inZone(last, tz, { day: "numeric", month: "short" });
      return `${t.barber} unavailable ${from === to ? from : `${from} to ${to}`}`;
    }),
  ];
  const offers = notices.filter((n) => n.kind === "offer");
  const directions = mapsDirectionsUrl(s);
  const byDay = new Map(hours.weekly.map((h) => [h.weekday, h]));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const mapKey = process.env.NEXT_PUBLIC_MAPS_EMBED_KEY;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: s.name,
    address: { "@type": "PostalAddress", streetAddress: s.address, addressCountry: "IN" },
    ...(s.lat && s.lng ? { geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } } : {}),
    ...(s.phone ? { telephone: `+${digits(s.phone)}` } : {}),
    openingHoursSpecification: hours.weekly.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: WEEKDAYS[h.weekday],
      opens: h.opens.slice(0, 5),
      closes: h.closes.slice(0, 5),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {alerts.length > 0 && (
        <aside aria-label="Notices" className="space-y-1 rounded-md border border-line bg-surface p-3 text-sm">
          {alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </aside>
      )}

      <section className="space-y-4 py-4">
        <h1 className="font-serif text-4xl leading-tight">{s.name}</h1>
        <p className="text-muted">{s.tagline}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/book" className={primary}>
            Book a slot
          </Link>
          {s.whatsappNumber && (
            <a href={`https://wa.me/${digits(s.whatsappNumber)}`} className={secondary}>
              WhatsApp
            </a>
          )}
        </div>
      </section>

      {offers.length > 0 && (
        <section aria-labelledby="offers" className="space-y-3">
          <h2 id="offers" className="font-serif text-2xl">
            Offers
          </h2>
          {offers.map((o) => (
            <article key={o.id} className="rounded-md border border-line bg-surface p-4">
              {o.badge && <span className="mb-1 inline-block text-xs font-medium text-accent">{o.badge}</span>}
              <h3 className="font-medium">{o.title}</h3>
              {o.body && <p className="text-sm text-muted">{o.body}</p>}
            </article>
          ))}
        </section>
      )}

      {barbers.length > 0 && (
        <section aria-labelledby="barbers" className="space-y-3">
          <h2 id="barbers" className="font-serif text-2xl">
            Barbers
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {barbers.map((b) => (
              <li key={b.id} className="rounded-md border border-line bg-surface p-4">
                <p className="font-medium">{b.name}</p>
                {b.bio && <p className="text-sm text-muted">{b.bio}</p>}
                {b.instagram && (
                  <a
                    href={`https://instagram.com/${b.instagram.replace(/^@/, "")}`}
                    className="mt-1 inline-flex min-h-11 items-center text-sm text-accent underline"
                  >
                    @{b.instagram.replace(/^@/, "")} on Instagram
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="visit" className="space-y-4">
        <h2 id="visit" className="font-serif text-2xl">
          Visit
        </h2>
        <p>{s.address}</p>
        <div className="flex flex-wrap gap-2">
          <a href={directions} className={secondary}>
            Directions
          </a>
          <ShareLocation url={directions} title={s.name} />
          {s.phone && (
            <a href={`tel:+${digits(s.phone)}`} className={secondary}>
              Call
            </a>
          )}
        </div>
        {mapKey && s.lat && s.lng && (
          <iframe
            title={`Map of ${s.name}`}
            loading="lazy"
            className="aspect-video w-full rounded-md border border-line"
            src={`https://www.google.com/maps/embed/v1/place?key=${mapKey}&q=${s.lat},${s.lng}`}
          />
        )}
        <table className="w-full text-sm">
          <caption className="sr-only">Opening hours</caption>
          <tbody>
            {order.map((d) => {
              const h = byDay.get(d);
              return (
                <tr key={d} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-normal">
                    {WEEKDAYS[d]}
                  </th>
                  <td className="py-2 text-right text-muted">{h ? `${clock(h.opens)} to ${clock(h.closes)}` : "Closed"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hours.special.length > 0 && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Special hours</p>
            {hours.special.map((h) => (
              <p key={h.id} className="text-muted">
                {h.label || "Special hours"}, {dateRange(h.startsOn, h.endsOn)}:{" "}
                {h.closed || !h.opens || !h.closes ? "closed" : `${clock(h.opens)} to ${clock(h.closes)}`}
              </p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
