export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minor units (paise/cents) to a display price. */
export function money(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(
    minor / 100,
  );
}

/** 75 -> "1 h 15 min", 120 -> "2 h", 45 -> "45 min". */
export function duration(min: number): string {
  const [h, m] = [Math.floor(min / 60), min % 60];
  return [h && `${h} h`, (m || !h) && `${m} min`].filter(Boolean).join(" ");
}

/** Running total for the service picker: "2 services, 1 h 15 min, ₹450". Price is left out when every price is 0. */
export function selectionSummary(items: { durationMin: number; priceMinor: number }[], currency = "INR"): string {
  if (!items.length) return "No services selected";
  const mins = items.reduce((n, x) => n + x.durationMin, 0);
  const price = items.reduce((n, x) => n + x.priceMinor, 0);
  return [`${items.length} service${items.length > 1 ? "s" : ""}`, duration(mins), price > 0 && money(price, currency)].filter(Boolean).join(", ");
}

/** "14:30[:00]" to "2:30 pm". */
export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** "2026-10-18" to "18 Oct". */
export function shortDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function dateRange(a: string, b: string): string {
  return a === b ? shortDate(a) : `${shortDate(a)} to ${shortDate(b)}`;
}

/** Instant formatted in the shop timezone. */
export function inZone(d: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(d);
}

/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
}

export function mapsDirectionsUrl(s: { lat: string | null; lng: string | null; address: string; name: string }): string {
  const q = s.lat && s.lng ? `${s.lat},${s.lng}` : `${s.name}, ${s.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Digits only, for wa.me and tel: links. */
export const digits = (phone: string) => phone.replace(/\D/g, "");
