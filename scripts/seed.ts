import { getDb } from "../src/lib/db";
import { seed } from "../src/lib/db/seed";

seed(getDb()).then(() => console.log("seeded"));
