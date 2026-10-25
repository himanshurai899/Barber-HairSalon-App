import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { waOutbound } from "@/lib/db/schema";
import { getSettings } from "@/lib/shop";
import { inZone } from "@/lib/format";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminHome() {
  const db = await getDb();
  const [rows, shop] = await Promise.all([db.select().from(waOutbound).orderBy(desc(waOutbound.createdAt)).limit(20), getSettings()]);
  const failed = rows.filter((r) => r.status === "failed").length;
  return (
    <main className="max-w-2xl space-y-8">
      <h1 className="font-serif text-3xl">Dashboard</h1>
      <section aria-labelledby="wa" className="space-y-3">
        <h2 id="wa" className="font-serif text-xl">
          WhatsApp messages
        </h2>
        <p className={failed ? "text-warn" : "text-muted"}>
          {failed ? `${failed} of the last ${rows.length} failed. Bookings are not affected.` : "Recent notifications to barbers and customers."}
        </p>
        {rows.length === 0 && <p className="text-muted">Nothing sent yet.</p>}
        <ul className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <span className={r.status === "failed" ? "font-medium text-warn" : "font-medium"}>{r.status}</span> {r.template}{" "}
              <span className="text-muted">
                {inZone(r.createdAt, shop.timezone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                {r.error ? `, ${r.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
