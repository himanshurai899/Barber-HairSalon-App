import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { expect, test } from "vitest";

// Proves the double-booking rule from docs/design-plan.md section 8 works in the test DB.
test("exclusion constraint rejects overlapping pending/approved bookings only", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    CREATE EXTENSION btree_gist;
    CREATE TABLE b (id serial PRIMARY KEY, barber int, during tstzrange, status text,
      EXCLUDE USING gist (barber WITH =, during WITH &&) WHERE (status IN ('pending','approved')));
  `);
  const ins = (barber: number, r: string, status: string) =>
    db.query("INSERT INTO b (barber, during, status) VALUES ($1, $2, $3)", [barber, r, status]);

  await ins(1, "[2026-11-01 10:00+00,2026-11-01 11:00+00)", "pending");
  await expect(ins(1, "[2026-11-01 10:30+00,2026-11-01 11:30+00)", "pending")).rejects.toThrow();
  await ins(1, "[2026-11-01 11:00+00,2026-11-01 12:00+00)", "approved"); // back-to-back is fine
  await ins(2, "[2026-11-01 10:00+00,2026-11-01 11:00+00)", "pending"); // other barber is fine
  await ins(1, "[2026-11-01 10:00+00,2026-11-01 11:00+00)", "rejected"); // rejected doesn't block
});
