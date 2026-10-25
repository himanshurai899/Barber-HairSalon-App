import { createAuth } from "../auth";
import { createStaffUser } from "../users";
import type { Db } from "./index";

// Local/e2e database only (USE_PGLITE=1). Never runs against a real DATABASE_URL.
export const DEMO_PASSWORD = "demo-password-1";

export async function seedDemoStaff(db: Db) {
  const auth = createAuth(db);
  await createStaffUser(db, auth, { email: "admin@demo.test", name: "Demo Admin", password: DEMO_PASSWORD, role: "admin" });
  await createStaffUser(db, auth, { email: "hitesh@demo.test", name: "Hitesh", password: DEMO_PASSWORD, role: "barber", barberId: 1 });
  await createStaffUser(db, auth, { email: "other@demo.test", name: "Demo Barber", password: DEMO_PASSWORD, role: "barber", barberId: 2 });
}
