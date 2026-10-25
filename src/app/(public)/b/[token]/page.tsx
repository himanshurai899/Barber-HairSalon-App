import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { cancelBooking, getBookingByToken } from "@/lib/booking-service";
import { getDb } from "@/lib/db";
import { inZone, mapsDirectionsUrl, money } from "@/lib/format";
import { getSettings } from "@/lib/shop";

// The private link is the only way to see a booking: keep it out of search results.
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

const copy = {
  pending: "Waiting for the barber to confirm. We will message you on WhatsApp.",
  approved: "Confirmed. See you then.",
  rejected: "Sorry, the barber could not take this slot.",
  expired: "This request was not confirmed in time. Please book again.",
  cancelled: "This booking was cancelled.",
} as const;

export default function BookingPage({ params }: PageProps<"/b/[token]">) {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <h1 className="font-serif text-3xl">Your booking</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>{params.then((p) => <Status token={p.token} />)}</Suspense>
    </main>
  );
}

async function Status({ token }: { token: string }) {
  const db = await getDb();
  const [b, shop] = await Promise.all([getBookingByToken(db, token), getSettings()]);
  if (!b) notFound();

  async function cancel() {
    "use server";
    await cancelBooking(await getDb(), token);
    redirect(`/b/${token}`);
  }

  const canCancel = b.status === "pending" || b.status === "approved";
  return (
    <>
      <p role="status" className="rounded-md border border-line bg-surface p-4">
        <span className="font-medium capitalize">{b.status}</span>
        <br />
        <span className="text-muted">{copy[b.status]}</span>
        {b.decisionNote && b.status === "rejected" && <span className="block text-muted">{b.decisionNote}</span>}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Name</dt>
        <dd>{b.customer}</dd>
        <dt className="text-muted">{b.services.length > 1 ? "Services" : "Service"}</dt>
        <dd>
          {b.services.map((x) => (
            <span key={x.name} className="block">
              {x.name}
            </span>
          ))}
        </dd>
        <dt className="text-muted">Barber</dt>
        <dd>{b.barber}</dd>
        <dt className="text-muted">When</dt>
        <dd>
          {inZone(b.during.start, shop.timezone, {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </dd>
        {b.priceMinor > 0 && (
          <>
            <dt className="text-muted">Price</dt>
            <dd>{money(b.priceMinor, shop.currency)}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <a href={mapsDirectionsUrl(shop)} className="inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm">
          Get directions
        </a>
        {canCancel && (
          <form action={cancel}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm text-warn">
              Cancel booking
            </button>
          </form>
        )}
      </div>
    </>
  );
}
