import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";
import * as schema from "./schema";

// The live database already has bookings: applying the booking_services migration on top must backfill them.
test("migration adds booking_services and backfills existing bookings from bookings.service_id", async () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  const idx = journal.entries.findIndex((e) => e.tag.includes("booking_services"));
  expect(idx, "a migration whose name contains booking_services").toBeGreaterThan(0);

  // Folder as it was before this feature: everything before that migration.
  const old = mkdtempSync(join(tmpdir(), "mig-"));
  try {
    cpSync("drizzle", old, { recursive: true });
    writeFileSync(join(old, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, idx) }));

    const client = new PGlite({ extensions: { btree_gist } });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: old });

    // Rows as the live database has them: no booking_services table yet.
    await client.exec(`
      insert into customers (phone, name) values ('+919825011111', 'Asha');
      insert into barbers (name) values ('Hitesh');
      insert into services (name, duration_min, price_minor) values ('Haircut', 30, 20000), ('Beard trim', 15, 10000);
      insert into bookings (customer_id, barber_id, service_id, during, status, source, price_minor) values
        (1, 1, 1, tstzrange('2026-11-02T04:30:00Z', '2026-11-02T05:00:00Z', '[)'), 'approved', 'web', 20000),
        (1, 1, 2, tstzrange('2026-11-02T06:00:00Z', '2026-11-02T06:15:00Z', '[)'), 'cancelled', 'phone', 9000);
    `);

    await migrate(db, { migrationsFolder: "drizzle" });

    const lines = await db.select().from(schema.bookingServices).orderBy(schema.bookingServices.bookingId);
    expect(lines.map((l) => [l.bookingId, l.serviceId, l.position, l.name, l.durationMin, l.priceMinor])).toEqual([
      [1, 1, 0, "Haircut", 30, 20000],
      [2, 2, 0, "Beard trim", 15, 9000], // price and length are what the booking recorded, not today's service row
    ]);
    // existing bookings are untouched
    const rows = await db.select().from(schema.bookings).orderBy(schema.bookings.id);
    expect(rows.map((b) => [b.serviceId, b.priceMinor, b.status])).toEqual([[1, 20000, "approved"], [2, 9000, "cancelled"]]);
    // the exclusion constraint survived
    await expect(
      client.exec(`insert into bookings (customer_id, barber_id, service_id, during, status, source, price_minor)
        values (1, 1, 1, tstzrange('2026-11-02T04:45:00Z', '2026-11-02T05:15:00Z', '[)'), 'pending', 'web', 1)`),
    ).rejects.toThrow();
  } finally {
    rmSync(old, { recursive: true, force: true });
  }
});
