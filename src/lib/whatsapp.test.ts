import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createLocalDb } from "./db/local-db";
import { customers, waInbound } from "./db/schema";
import { seed } from "./db/seed";
import { sendCtaUrl, verifySignature } from "./whatsapp";
import { handleInbound, handlePost, handleVerify } from "./whatsapp-webhook";

type Db = Awaited<ReturnType<typeof createLocalDb>>;
let db: Db;
const SECRET = "app-secret";
const now = new Date("2026-11-01T10:00:00Z");
const sign = (body: string, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

const payload = (id: string, from = "919825011111", name = "Asha") => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: {
    contacts: [{ profile: { name }, wa_id: from }],
    messages: [{ from, id, type: "text", text: { body: "hi" } }],
  } }] }],
});

beforeEach(async () => {
  db = await createLocalDb();
  await seed(db);
});

describe("verifySignature", () => {
  test("accepts a correct HMAC and rejects everything else", () => {
    const body = '{"a":1}';
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
    expect(verifySignature(body, sign(body, "other"), SECRET)).toBe(false);
    expect(verifySignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=zz", SECRET)).toBe(false);
    expect(verifySignature(body, sign(body), "")).toBe(false);
  });
});

describe("handleVerify (GET handshake)", () => {
  const url = (q: string) => new URL(`https://x.test/api/whatsapp?${q}`);
  test("echoes the challenge only for the right token", () => {
    expect(handleVerify(url("hub.mode=subscribe&hub.verify_token=tok&hub.challenge=123"), "tok")).toEqual({ status: 200, body: "123" });
    expect(handleVerify(url("hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123"), "tok").status).toBe(403);
    expect(handleVerify(url("hub.mode=subscribe&hub.verify_token=&hub.challenge=1"), "").status).toBe(403);
  });
});

describe("handleInbound", () => {
  const opts = () => ({ send: vi.fn().mockResolvedValue(undefined), siteUrl: "https://salon.test", now });

  test("greets a new number with the settings text and a booking link, and upserts the customer", async () => {
    const o = opts();
    await handleInbound(db, payload("wamid.1"), o);
    expect(o.send).toHaveBeenCalledTimes(1);
    const m = o.send.mock.calls[0][0];
    expect(m.to).toBe("919825011111");
    expect(m.body).toContain("Hi Asha");
    expect(m.buttonText).toBe("Book a slot");
    expect(m.url).toBe("https://salon.test/book?src=wa");
    const [c] = await db.select().from(customers);
    expect([c.phone, c.name]).toEqual(["+919825011111", "Asha"]);
    expect(await db.select().from(waInbound)).toHaveLength(1);
  });

  test("the same message id delivered twice greets once", async () => {
    const o = opts();
    await handleInbound(db, payload("wamid.1"), o);
    await handleInbound(db, payload("wamid.1"), o);
    expect(o.send).toHaveBeenCalledTimes(1);
    expect(await db.select().from(waInbound)).toHaveLength(1);
  });

  test("another message within 24h is not greeted again, after 24h it is", async () => {
    const o = opts();
    await handleInbound(db, payload("wamid.1"), o);
    await handleInbound(db, payload("wamid.2"), { ...o, now: new Date(now.getTime() + 23 * 3600_000) });
    expect(o.send).toHaveBeenCalledTimes(1);
    await handleInbound(db, payload("wamid.3"), { ...o, now: new Date(now.getTime() + 25 * 3600_000) });
    expect(o.send).toHaveBeenCalledTimes(2);
  });

  test("different numbers are greeted separately; status-only payloads are ignored", async () => {
    const o = opts();
    await handleInbound(db, payload("wamid.1", "919825011111"), o);
    await handleInbound(db, payload("wamid.2", "919825022222", "Bina"), o);
    expect(o.send).toHaveBeenCalledTimes(2);
    await handleInbound(db, { entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "x" }] } }] }] }, o);
    expect(o.send).toHaveBeenCalledTimes(2);
  });

  test("a failing send does not throw and the message stays recorded", async () => {
    const o = { ...opts(), send: vi.fn().mockRejectedValue(new Error("Meta down")) };
    await expect(handleInbound(db, payload("wamid.1"), o)).resolves.toBeUndefined();
    expect(await db.select().from(waInbound)).toHaveLength(1);
  });

  test("an existing customer keeps their name", async () => {
    await db.insert(customers).values({ phone: "+919825011111", name: "Asha Patel" });
    await handleInbound(db, payload("wamid.1"), opts());
    expect((await db.select().from(customers))[0].name).toBe("Asha Patel");
  });

  test("malformed payloads are ignored", async () => {
    const o = opts();
    await handleInbound(db, { nothing: true }, o);
    await handleInbound(db, null, o);
    expect(o.send).not.toHaveBeenCalled();
  });
});

describe("handlePost", () => {
  const env = { appSecret: SECRET, siteUrl: "https://salon.test" };
  const req = (body: string, sig: string | null) =>
    new Request("https://x.test/api/whatsapp", { method: "POST", body, headers: sig ? { "x-hub-signature-256": sig } : {} });

  test("bad or missing signature is rejected and nothing is processed", async () => {
    const send = vi.fn();
    const body = JSON.stringify(payload("wamid.1"));
    expect((await handlePost(req(body, sign(body, "wrong")), db, { ...env, send, now })).status).toBe(401);
    expect((await handlePost(req(body, null), db, { ...env, send, now })).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
    expect(await db.select().from(waInbound)).toHaveLength(0);
  });

  test("valid signature processes and returns 200", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const body = JSON.stringify(payload("wamid.1"));
    expect((await handlePost(req(body, sign(body)), db, { ...env, send, now })).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("valid signature but invalid JSON is a 400", async () => {
    const body = "not json";
    expect((await handlePost(req(body, sign(body)), db, { ...env, send: vi.fn(), now })).status).toBe(400);
  });
});

describe("sendCtaUrl", () => {
  test("posts an interactive cta_url message to the Cloud API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("WA_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WA_ACCESS_TOKEN", "tok");
    await sendCtaUrl({ to: "919825011111", body: "Hello", buttonText: "Book a slot", url: "https://salon.test/book?src=wa" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
    expect(init.headers.Authorization).toBe("Bearer tok");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      messaging_product: "whatsapp",
      to: "919825011111",
      type: "interactive",
      interactive: { type: "cta_url", body: { text: "Hello" }, action: { name: "cta_url", parameters: { display_text: "Book a slot", url: "https://salon.test/book?src=wa" } } },
    });
    fetchMock.mockResolvedValue(new Response("nope", { status: 400 }));
    await expect(sendCtaUrl({ to: "1", body: "x", buttonText: "y", url: "https://z.test" })).rejects.toThrow(/400/);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
