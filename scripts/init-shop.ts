import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { applyShopProfile } from "../src/lib/db/shop-profile";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
applyShopProfile(drizzle(neon(url), { schema })).then(() => console.log("shop profile applied"));
