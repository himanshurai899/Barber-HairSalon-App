// Inbound WhatsApp webhook logic (design-plan section 10). The route handler is a thin wrapper.
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "./db";
import * as s from "./db/schema";
import { normalizePhone } from "./phone";
import { loadSettings } from "./shop";
import { sendCtaUrl, verifySignature, type CtaMessage } from "./whatsapp";

type Json = Record<string, unknown>;
const DAY = 24 * 3600_000;

/** GET handshake Meta does when the webhook is configured. */
export function handleVerify(url: URL, verifyToken: string) {
  const p = url.searchParams;
  if (verifyToken && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === verifyToken) {
    return { status: 200, body: p.get("hub.challenge") ?? "" };
  }
  return { status: 403, body: "Forbidden" };
}

type Opts = { send?: (m: CtaMessage) => Promise<void>; siteUrl: string; now?: Date };

/** Records each message once, upserts the customer, and greets a number at most once per 24h. Never throws on send failures. */
export async function handleInbound(db: Db, payload: unknown, o: Opts) {
  const send = o.send ?? sendCtaUrl;
  const now = o.now ?? new Date();
  const entries = ((payload as Json | null)?.entry as Json[] | undefined) ?? [];
  for (const change of entries.flatMap((e) => (e.changes as Json[] | undefined) ?? [])) {
    const value = (change.value ?? {}) as Json;
    const names = new Map(((value.contacts as Json[] | undefined) ?? []).map((c) => [String(c.wa_id), String((c.profile as Json | undefined)?.name ?? "")]));
    for (const msg of (value.messages as Json[] | undefined) ?? []) {
      const from = String(msg.from ?? "").replace(/\D/g, "");
      const id = String(msg.id ?? "");
      if (!from || !id) continue;

      const fresh = await db.insert(s.waInbound).values({ waMessageId: id, fromPhone: from, receivedAt: now }).onConflictDoNothing().returning();
      if (!fresh.length) continue; // Meta retries: already handled

      const name = names.get(from) || "";
      await db.insert(s.customers).values({ phone: normalizePhone(`+${from}`) ?? `+${from}`, name: name || "WhatsApp customer", waOptIn: false }).onConflictDoNothing();

      const recent = await db
        .select({ id: s.waInbound.waMessageId })
        .from(s.waInbound)
        .where(and(eq(s.waInbound.fromPhone, from), gt(s.waInbound.greetedAt, new Date(now.getTime() - DAY))))
        .limit(1);
      if (recent.length) continue;

      const settings = await loadSettings(db);
      await db.update(s.waInbound).set({ greetedAt: now }).where(eq(s.waInbound.waMessageId, id));
      try {
        await send({
          to: from,
          body: settings.greetingText.replaceAll("{name}", name || "there"),
          buttonText: "Book a slot",
          url: `${o.siteUrl}/book?src=wa`,
        });
      } catch (e) {
        console.error("WhatsApp greeting failed", e instanceof Error ? e.message : e);
      }
    }
  }
}

/** POST: verify the signature on the raw body first, then process. */
export async function handlePost(req: Request, db: Db, o: Opts & { appSecret: string }) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), o.appSecret)) return { status: 401, body: "Bad signature" };
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { status: 400, body: "Bad JSON" };
  }
  await handleInbound(db, payload, o);
  return { status: 200, body: "ok" };
}
