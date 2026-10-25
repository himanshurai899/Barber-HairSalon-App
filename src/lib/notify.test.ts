import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createBooking } from "./booking-service";
import { barbers, bookings, customers, waOutbound } from "./db/schema";
import { createLocalDb } from "./db/local-db";
import { seed } from "./db/seed";
import { notifyDecision, notifyNewRequest } from "./notify";
import { sendTemplate } from "./whatsapp";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const now = new Date("2026-11-01T06:00:00Z");
const site = "https://salon.test";

async function book(over: { waOptIn?: boolean; barber?: number } = {}) {
  const r = await createBooking(
    db,
    { serviceIds: [1], barber: over.barber ?? 1, date: "2026-11-02", time: "10:00", name: "Asha", phone: "98250 11111", waOptIn: over.waOptIn ?? true },
    now,
  );
  if (!r.ok) throw new Error("setup");
  return r;
}

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
  await db.update(barbers).set({ phone: "+91 98250 99999" }).where(eq(barbers.id, 1));
});

describe("notifyNewRequest", () => {
  test("alerts the barber with a link to /staff and logs it", async () => {
    const r = await book();
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyNewRequest(db, r.id, { send, siteUrl: site });
    expect(send).toHaveBeenCalledWith({
      to: "919825099999",
      template: "booking_request_barber",
      params: ["Asha", "Haircut", "Mon 2 Nov, 10:00 am", `${site}/staff`],
    });
    const [log] = await db.select().from(waOutbound);
    expect([log.bookingId, log.template, log.status]).toEqual([r.id, "booking_request_barber", "sent"]);
  });

  test("a barber without a phone is skipped and logged", async () => {
    const r = await book({ barber: 2 });
    const send = vi.fn();
    await notifyNewRequest(db, r.id, { send, siteUrl: site });
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(waOutbound))[0].status).toBe("skipped");
  });

  test("a failing send never throws, never touches the booking, and is logged as failed", async () => {
    const r = await book();
    const send = vi.fn().mockRejectedValue(new Error("WhatsApp API 500: boom"));
    await expect(notifyNewRequest(db, r.id, { send, siteUrl: site })).resolves.toBeUndefined();
    const [log] = await db.select().from(waOutbound);
    expect([log.status, log.error]).toEqual(["failed", "WhatsApp API 500: boom"]);
    expect((await db.select().from(bookings))[0].status).toBe("pending");
  });
});

describe("notifyDecision", () => {
  test("confirmation goes to a customer who opted in", async () => {
    const r = await book();
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyDecision(db, r.id, "approved", { send, siteUrl: site });
    expect(send).toHaveBeenCalledWith({
      to: "919825011111",
      template: "booking_confirmed",
      params: ["Asha", "Haircut", "Mon 2 Nov, 10:00 am", `${site}/b/${r.token}`],
    });
  });

  test("decline carries the reason, or a dash when there is none", async () => {
    const r = await book();
    const send = vi.fn().mockResolvedValue(undefined);
    await db.update(bookings).set({ decisionNote: "Away that day" });
    await notifyDecision(db, r.id, "rejected", { send, siteUrl: site });
    expect(send.mock.calls[0][0]).toMatchObject({ template: "booking_declined", params: ["Asha", "Haircut", "Mon 2 Nov, 10:00 am", "Away that day"] });
    await db.update(bookings).set({ decisionNote: null });
    await notifyDecision(db, r.id, "rejected", { send, siteUrl: site });
    expect(send.mock.calls[1][0].params[3]).toBe("-");
  });

  test("a customer who did not consent gets nothing", async () => {
    const r = await book({ waOptIn: false });
    const send = vi.fn();
    await notifyDecision(db, r.id, "approved", { send, siteUrl: site });
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(waOutbound))[0].status).toBe("skipped");
    expect((await db.select().from(customers))[0].waOptIn).toBe(false);
  });

  test("failure is logged and swallowed", async () => {
    const r = await book();
    const send = vi.fn().mockRejectedValue(new Error("down"));
    await expect(notifyDecision(db, r.id, "approved", { send, siteUrl: site })).resolves.toBeUndefined();
    expect((await db.select().from(waOutbound))[0].status).toBe("failed");
  });
});

describe("createBooking result", () => {
  test("reports created only for a new booking, not a double submit", async () => {
    const a = await book();
    const b = await book();
    expect([a.created, b.created, a.id === b.id]).toEqual([true, false, true]);
  });
});

describe("sendTemplate", () => {
  test("posts a template message with body parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WA_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WA_ACCESS_TOKEN", "tok");
    await sendTemplate({ to: "919825011111", template: "booking_confirmed", params: ["Asha", "Haircut"] });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({
      messaging_product: "whatsapp",
      to: "919825011111",
      type: "template",
      template: {
        name: "booking_confirmed",
        language: { code: "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Asha" }, { type: "text", text: "Haircut" }] }],
      },
    });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
