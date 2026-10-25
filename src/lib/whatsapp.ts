// WhatsApp Cloud API: signature check and the few send calls we use (plain fetch, no SDK).
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://graph.facebook.com/v21.0";

/** X-Hub-Signature-256: HMAC-SHA256 of the raw body with the app secret. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function post(payload: object) {
  const id = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;
  if (!id || !token) throw new Error("WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN are not set");
  const res = await fetch(`${API}/${id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export type CtaMessage = { to: string; body: string; buttonText: string; url: string };

/** Interactive message with one "open link" button. Only valid inside the 24h customer service window. */
export function sendCtaUrl(m: CtaMessage) {
  return post({
    to: m.to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: m.body },
      action: { name: "cta_url", parameters: { display_text: m.buttonText, url: m.url } },
    },
  });
}

export type TemplateMessage = { to: string; template: string; params: string[] };

/** Pre-approved utility template (works outside the 24h window). Body variables only. */
export function sendTemplate(m: TemplateMessage) {
  return post({
    to: m.to,
    type: "template",
    template: {
      name: m.template,
      language: { code: "en" },
      components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text })) }],
    },
  });
}
