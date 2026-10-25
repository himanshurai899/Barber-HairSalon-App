// Usage: DATABASE_URL=... BETTER_AUTH_SECRET=... pnpm admin:create you@example.com "Your Name" "a-long-password"
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createAuth } from "../src/lib/auth";
import * as schema from "../src/lib/db/schema";
import { createStaffUser } from "../src/lib/users";

const [email, name, password] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url || !email || !name || !password) throw new Error("Need DATABASE_URL and args: email name password");
const db = drizzle(neon(url), { schema });
createStaffUser(db, createAuth(db), { email, name, password, role: "admin" }).then((u) => console.log("created admin", u.email));
