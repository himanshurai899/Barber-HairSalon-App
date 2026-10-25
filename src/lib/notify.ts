// WhatsApp template notifications (design-plan section 10). Run after the booking is committed:
// a failure is logged to wa_outbound (visible in admin) and never touches the booking.
import parsePhoneNumber from "libphonenumber-js";
import { eq } from "drizzle-orm";
import { withServices } from "./booking-lines";
import type { Db } from "./db";
import * as s from "./db/schema";
import { inZone } from "./format";
import { loadSettings } from "./shop";
import { sendTemplate, type TemplateMessage } from "./whatsapp";

type Opts = { send?: (m: TemplateMessage) => Promise<void>; siteUrl: string };

async function load(db: Db, bookingId: number) {
  const [b] = await db
    .select({
      token: s.bookings.manageToken,
      id: s.bookings.id,
      priceMinor: s.bookings.priceMinor,
      during: s.bookings.during,
      decisionNote: s.bookings.decisionNote,
      service: s.services.name,
      customer: s.customers.name,
      customerPhone: s.customers.phone,
      waOptIn: s.customers.waOptIn,
      barberPhone: s.barbers.phone,
    })
    .from(s.bookings)
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .innerJoin(s.barbers, eq(s.barbers.id, s.bookings.barberId))
    .where(eq(s.bookings.id, bookingId));
  return (await withServices(db, [b]))[0]; // service = every service joined with " + "
}

const digits = (phone: string | null) => {
  const p = phone ? parsePhoneNumber(phone, "IN") : undefined;
  return p?.isValid() ? p.number.slice(1) : null;
};

async function deliver(db: Db, o: Opts, bookingId: number, template: string, to: string | null, params: string[], skipReason?: string) {
  const log = (status: "sent" | "failed" | "skipped", error?: string) =>
    db.insert(s.waOutbound).values({ bookingId, toPhone: to, template, status, error: error ?? null }).catch((e) => console.error("wa_outbound log failed", e));
  if (!to || skipReason) return void (await log("skipped", skipReason ?? "no valid phone number"));
  try {
    await (o.send ?? sendTemplate)({ to, template, params });
    await log("sent");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`WhatsApp ${template} failed`, msg);
    await log("failed", msg);
  }
}

async function safely(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error("notification error", e instanceof Error ? e.message : e);
  }
}

/** "Mon 2 Nov, 10:00 am" in shop time. */
function when(d: Date, tz: string) {
  const p = (opts: Intl.DateTimeFormatOptions) => inZone(d, tz, opts);
  return `${p({ weekday: "short" })} ${p({ day: "numeric" })} ${p({ month: "short" })}, ${p({ hour: "numeric", minute: "2-digit", hour12: true })}`;
}

/** New pending request: alert the barber. */
export const notifyNewRequest = (db: Db, bookingId: number, o: Opts) =>
  safely(async () => {
    const [b, tz] = [await load(db, bookingId), (await loadSettings(db)).timezone];
    await deliver(db, o, bookingId, "booking_request_barber", digits(b.barberPhone), [b.customer, b.service, when(b.during.start, tz), `${o.siteUrl}/staff`], b.barberPhone ? undefined : "barber has no phone number");
  });

/** Approved or rejected: tell the customer, only if they consented. */
export const notifyDecision = (db: Db, bookingId: number, decision: "approved" | "rejected", o: Opts) =>
  safely(async () => {
    const [b, tz] = [await load(db, bookingId), (await loadSettings(db)).timezone];
    const template = decision === "approved" ? "booking_confirmed" : "booking_declined";
    const last = decision === "approved" ? `${o.siteUrl}/b/${b.token}` : b.decisionNote || "-";
    await deliver(db, o, bookingId, template, b.customerPhone.slice(1), [b.customer, b.service, when(b.during.start, tz), last], b.waOptIn ? undefined : "customer did not opt in to WhatsApp updates");
  });
