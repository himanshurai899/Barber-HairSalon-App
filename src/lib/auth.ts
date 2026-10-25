import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "./db";
import { getDb } from "./db";
import * as schema from "./db/schema";

// Staff only: accounts are created by an admin (or the create-admin script), never by visitors.
export function createAuth(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
    user: { additionalFields: { role: { type: "string", defaultValue: "barber", input: false } } },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as unknown as { __auth?: Auth };

export async function getAuth(): Promise<Auth> {
  const db = await getDb(); // first: request-time guard, nothing is cached during prerender
  return (g.__auth ??= createAuth(db));
}
