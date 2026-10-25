import { beforeEach, expect, test } from "vitest";
import { createAuth } from "./auth";
import { createLocalDb } from "./db/local-db";
import { barbers } from "./db/schema";
import { createStaffUser, loadActor } from "./users";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123";
  db = await createLocalDb();
  auth = createAuth(db);
});

test("a created barber login can sign in and carries the barber role", async () => {
  const [barber] = await db.insert(barbers).values({ name: "Hitesh" }).returning();
  await createStaffUser(db, auth, {
    email: "Hitesh@Example.test", name: "Hitesh", password: "correct horse battery", role: "barber", barberId: barber.id,
  });
  const { headers, response } = await auth.api.signInEmail({
    body: { email: "hitesh@example.test", password: "correct horse battery" },
    returnHeaders: true,
  });
  expect(response.user.email).toBe("hitesh@example.test");
  const session = await auth.api.getSession({ headers: new Headers({ cookie: headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") }) });
  expect(session?.user.role).toBe("barber");
  expect(await loadActor(db, session!.user.id, "barber")).toEqual({ userId: session!.user.id, role: "barber", barberId: barber.id });
});

test("wrong password is rejected", async () => {
  await createStaffUser(db, auth, { email: "a@example.test", name: "A", password: "correct horse battery", role: "admin" });
  await expect(auth.api.signInEmail({ body: { email: "a@example.test", password: "wrong password" } })).rejects.toThrow();
});

test("public sign-up is disabled", async () => {
  await expect(
    auth.api.signUpEmail({ body: { email: "x@example.test", name: "X", password: "correct horse battery" } }),
  ).rejects.toThrow();
});

test("short passwords are refused", async () => {
  await expect(
    createStaffUser(db, auth, { email: "b@example.test", name: "B", password: "short", role: "barber" }),
  ).rejects.toThrow(/8/);
});
