import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { money } from "@/lib/format";
import { getServices, getSettings } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Services and prices",
  description: "Haircuts, beard trims and more at Krishna Hair Salon, Gotri, Vadodara.",
};

export default function ServicesPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="font-serif text-3xl">Services</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ServiceList />
      </Suspense>
      <Link href="/book" className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm text-bg">
        Book a slot
      </Link>
    </main>
  );
}

async function ServiceList() {
  const [services, s] = await Promise.all([getServices(), getSettings()]);
  const groups = Map.groupBy(services, (x) => x.category);
  if (!services.length) return <p className="text-muted">Services will be listed soon.</p>;
  return (
    <>
      {[...groups].map(([category, items]) => (
        <section key={category} aria-labelledby={`c-${category}`} className="space-y-2">
          <h2 id={`c-${category}`} className="font-serif text-xl">
            {category}
          </h2>
          <ul>
            {items.map((x) => (
              <li key={x.id} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                <span>
                  {x.name} <span className="text-sm text-muted">{x.durationMin} min</span>
                </span>
                <span>{money(x.priceMinor, s.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted">
        Prices may vary depending on hair length, product usage and service requirements. &ldquo;From&rdquo; prices are the starting price.
      </p>
    </>
  );
}
