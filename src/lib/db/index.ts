import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { connection } from "next/server";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __localDb?: Promise<Db> };

/** Neon in production. With USE_PGLITE=1 and no DATABASE_URL: a seeded in-memory Postgres (e2e, local demo). */
export async function getDb(): Promise<Db> {
  await connection(); // request-time data: never evaluated during prerender
  const url = process.env.DATABASE_URL;
  if (url) return drizzle(neon(url), { schema });
  if (process.env.USE_PGLITE === "1") {
    g.__localDb ??= (async () => {
      const { createLocalDb } = await import("./local-db");
      const { seed } = await import("./seed");
      const db = await createLocalDb();
      await seed(db);
      await (await import("./demo-staff")).seedDemoStaff(db);
      return db;
    })();
    return g.__localDb;
  }
  throw new Error("DATABASE_URL is not set");
}
