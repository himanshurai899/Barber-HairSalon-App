// Pure slot engine, design-plan section 9. No I/O: callers load the rows and pass them in.
import type { BookingStatus } from "./db/schema";

export type SlotInput = {
  date: string; // YYYY-MM-DD, shop-local
  services: { id: number; durationMin: number }[]; // one booking: lengths add up, the barber must offer all of them
  barbers: { id: number; sort: number; active: boolean; serviceIds: number[] }[];
  shopHours: { weekday: number; opens: string; closes: string }[]; // no row = closed
  specialHours: { startsOn: string; endsOn: string; opens: string | null; closes: string | null; closed: boolean }[];
  availability: { barberId: number; weekday: number; startTime: string; endTime: string }[];
  timeOff: { barberId: number; start: Date; end: Date }[];
  bookings: { barberId: number; start: Date; end: Date; status: BookingStatus }[];
  settings: { timezone: string; slotStepMin: number; minNoticeMin: number; horizonDays: number };
  now: Date;
};

export type Slot = { start: Date; barberIds: number[] };

const MIN = 60_000;
const blocking: BookingStatus[] = ["pending", "approved"];

/** Offset (ms) of `tz` from UTC at the given instant. */
function offsetAt(instant: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Shop-local date + "HH:MM" to a UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetAt(guess, tz);
  return new Date(guess - offsetAt(first, tz)); // second pass settles DST edges
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;

export function getSlots(i: SlotInput): Slot[] {
  const { date, services, settings, now } = i;
  const tz = settings.timezone;
  const weekday = weekdayOf(date);

  // 1. Shop hours: special range wins over weekly row.
  const special = i.specialHours.find((s) => s.startsOn <= date && date <= s.endsOn);
  const shop = special
    ? special.closed || !special.opens || !special.closes ? null : { opens: special.opens, closes: special.closes }
    : i.shopHours.find((h) => h.weekday === weekday) ?? null;
  if (!shop) return [];
  const shopS = zonedToUtc(date, shop.opens, tz).getTime();
  const shopE = zonedToUtc(date, shop.closes, tz).getTime();

  const earliest = now.getTime() + settings.minNoticeMin * MIN;
  const latest = now.getTime() + settings.horizonDays * 24 * 60 * MIN;
  const dur = services.reduce((n, x) => n + x.durationMin, 0) * MIN;
  const step = settings.slotStepMin * MIN;
  const byStart = new Map<number, number[]>();

  for (const barber of i.barbers) {
    if (!barber.active || !services.every((x) => barber.serviceIds.includes(x.id))) continue;
    const busy = [
      ...i.timeOff.filter((o) => o.barberId === barber.id).map((o) => [o.start.getTime(), o.end.getTime()]),
      ...i.bookings
        .filter((b) => b.barberId === barber.id && blocking.includes(b.status))
        .map((b) => [b.start.getTime(), b.end.getTime()]),
    ];
    for (const w of i.availability.filter((a) => a.barberId === barber.id && a.weekday === weekday)) {
      // 2. Working window clipped to shop hours.
      const winS = Math.max(shopS, zonedToUtc(date, w.startTime, tz).getTime());
      const winE = Math.min(shopE, zonedToUtc(date, w.endTime, tz).getTime());
      // 3. Walk in steps; keep starts where the service fits and nothing busy overlaps.
      for (let s = winS; s + dur <= winE; s += step) {
        if (s < earliest || s > latest) continue; // 4.
        if (busy.some(([bs, be]) => overlaps(s, s + dur, bs, be))) continue;
        byStart.set(s, [...(byStart.get(s) ?? []), barber.id]);
      }
    }
  }

  // 5. Any available: union per start, barbers in sort order.
  const sort = new Map(i.barbers.map((b) => [b.id, b.sort]));
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([s, ids]) => ({
      start: new Date(s),
      barberIds: [...new Set(ids)].sort((a, b) => sort.get(a)! - sort.get(b)!),
    }));
}

/** "Any available" on submit: fewest bookings that local day, ties by barber sort. */
export function pickBarber(a: {
  barberIds: number[];
  barbers: { id: number; sort: number }[];
  bookings: { barberId: number; start: Date; status: BookingStatus }[];
  date: string;
  timezone: string;
}): number {
  const dayS = zonedToUtc(a.date, "00:00", a.timezone).getTime();
  const next = new Date(`${a.date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayE = zonedToUtc(next.toISOString().slice(0, 10), "00:00", a.timezone).getTime();
  const count = (id: number) =>
    a.bookings.filter(
      (b) => b.barberId === id && blocking.includes(b.status) && b.start.getTime() >= dayS && b.start.getTime() < dayE,
    ).length;
  const sort = (id: number) => a.barbers.find((b) => b.id === id)?.sort ?? 0;
  return [...a.barberIds].sort((x, y) => count(x) - count(y) || sort(x) - sort(y))[0];
}
