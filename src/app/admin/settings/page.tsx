import type { Metadata } from "next";
import { getSettings } from "@/lib/shop";
import { AdminForm, Field, field } from "../admin-form";
import { saveSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsAdmin() {
  const s = await getSettings();
  return (
    <main className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Settings</h1>
      <AdminForm action={saveSettingsAction}>
        <Field label="Shop name" name="name" defaultValue={s.name} required />
        <Field label="Tagline" name="tagline" defaultValue={s.tagline} />
        <Field label="Address" name="address" defaultValue={s.address} required />
        <Field label="Latitude" name="lat" defaultValue={s.lat} hint="From Google Maps, for Directions and the map." />
        <Field label="Longitude" name="lng" defaultValue={s.lng} />
        <Field label="Google place id (optional)" name="mapsPlaceId" defaultValue={s.mapsPlaceId} />
        <Field label="Phone (with country code)" name="phone" type="tel" defaultValue={s.phone} />
        <Field label="WhatsApp number (with country code)" name="whatsappNumber" type="tel" defaultValue={s.whatsappNumber} />
        <Field label="Timezone" name="timezone" defaultValue={s.timezone} required />
        <Field label="Currency" name="currency" defaultValue={s.currency} required />
        <label className="block text-sm">
          WhatsApp greeting
          <textarea name="greetingText" defaultValue={s.greetingText} rows={4} required className={`${field} py-2`} />
          <span className="text-muted">{"{name}"} becomes the customer&apos;s name. The Book a slot button is added automatically.</span>
        </label>
        <Field label="Pending request expires after (minutes)" name="pendingTtlMin" type="number" defaultValue={s.pendingTtlMin} required />
        <Field label="Slot step (minutes)" name="slotStepMin" type="number" defaultValue={s.slotStepMin} required />
        <Field label="Minimum notice (minutes)" name="minNoticeMin" type="number" defaultValue={s.minNoticeMin} required />
        <Field label="Book up to (days ahead)" name="horizonDays" type="number" defaultValue={s.horizonDays} required />
        <Field label="Open bookings allowed per phone" name="maxOpenPerPhone" type="number" defaultValue={s.maxOpenPerPhone} required />
      </AdminForm>
    </main>
  );
}
