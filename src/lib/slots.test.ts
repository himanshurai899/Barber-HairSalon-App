import { describe, expect, test } from "vitest";
import { getSlots, pickBarber, type SlotInput } from "./slots";

// 2026-11-02 is a Monday. Asia/Kolkata is UTC+05:30, so 10:00 local = 04:30Z.
const utc = (iso: string) => new Date(iso);
const ist = (hhmm: string, date = "2026-11-02") => new Date(`${date}T${hhmm}:00+05:30`);

function input(over: Partial<SlotInput> = {}): SlotInput {
  return {
    date: "2026-11-02",
    services: [{ id: 1, durationMin: 30 }],
    barbers: [{ id: 1, sort: 1, active: true, serviceIds: [1] }],
    shopHours: [{ weekday: 1, opens: "10:00", closes: "12:00" }],
    specialHours: [],
    availability: [{ barberId: 1, weekday: 1, startTime: "10:00", endTime: "12:00" }],
    timeOff: [],
    bookings: [],
    settings: { timezone: "Asia/Kolkata", slotStepMin: 30, minNoticeMin: 60, horizonDays: 30 },
    now: utc("2026-11-01T00:00:00Z"),
    ...over,
  };
}
const starts = (i: SlotInput) => getSlots(i).map((s) => s.start.toISOString());
const t = (...h: string[]) => h.map((x) => ist(x).toISOString());

describe("getSlots", () => {
  test("walks the window in steps and keeps starts where the service fits", () => {
    expect(starts(input())).toEqual(t("10:00", "10:30", "11:00", "11:30"));
    expect(starts(input({ services: [{ id: 1, durationMin: 60 }] }))).toEqual(t("10:00", "10:30", "11:00"));
  });

  test("service longer than the window gives nothing", () => {
    expect(starts(input({ services: [{ id: 1, durationMin: 150 }] }))).toEqual([]);
  });

  test("closed weekday gives nothing", () => {
    expect(starts(input({ date: "2026-11-03" }))).toEqual([]);
  });

  test("special hours override the weekly hours", () => {
    const special = { startsOn: "2026-11-01", endsOn: "2026-11-05", opens: "10:00", closes: "11:00", closed: false };
    expect(starts(input({ specialHours: [special] }))).toEqual(t("10:00", "10:30"));
    expect(starts(input({ specialHours: [{ ...special, closed: true }] }))).toEqual([]);
    // special range opening earlier than the weekly hours, barber works all day
    const wide = { ...special, opens: "09:00", closes: "12:00" };
    const avail = [{ barberId: 1, weekday: 1, startTime: "09:00", endTime: "12:00" }];
    expect(starts(input({ specialHours: [wide], availability: avail }))[0]).toBe(ist("09:00").toISOString());
  });

  test("special hours only apply inside their date range", () => {
    const special = { startsOn: "2026-11-09", endsOn: "2026-11-10", opens: "10:00", closes: "11:00", closed: true };
    expect(starts(input({ specialHours: [special] }))).toHaveLength(4);
  });

  test("barber time off removes only that barber, others stay bookable", () => {
    const two = input({
      barbers: [
        { id: 1, sort: 1, active: true, serviceIds: [1] },
        { id: 2, sort: 2, active: true, serviceIds: [1] },
      ],
      availability: [
        { barberId: 1, weekday: 1, startTime: "10:00", endTime: "12:00" },
        { barberId: 2, weekday: 1, startTime: "10:00", endTime: "12:00" },
      ],
      timeOff: [{ barberId: 1, start: ist("00:00"), end: ist("23:59") }],
    });
    const slots = getSlots(two);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.barberIds.join() === "2")).toBe(true);
  });

  test("a break in the middle of the day splits the windows", () => {
    const i = input({
      availability: [
        { barberId: 1, weekday: 1, startTime: "10:00", endTime: "11:00" },
        { barberId: 1, weekday: 1, startTime: "11:30", endTime: "12:00" },
      ],
    });
    expect(starts(i)).toEqual(t("10:00", "10:30", "11:30"));
  });

  test("pending and approved bookings block, rejected ones do not; back-to-back is fine", () => {
    const b = (status: "pending" | "approved" | "rejected" | "cancelled" | "expired", s: string, e: string) => ({
      barberId: 1,
      start: ist(s),
      end: ist(e),
      status,
    });
    expect(starts(input({ bookings: [b("pending", "10:00", "10:30")] }))).toEqual(t("10:30", "11:00", "11:30"));
    expect(starts(input({ bookings: [b("approved", "10:30", "11:30")] }))).toEqual(t("10:00", "11:30"));
    const free = [b("rejected", "10:00", "12:00"), b("cancelled", "10:00", "12:00"), b("expired", "10:00", "12:00")];
    expect(starts(input({ bookings: free }))).toHaveLength(4);
  });

  test("a booking overlapping only part of a long service still blocks it", () => {
    const i = input({
      services: [{ id: 1, durationMin: 60 }],
      bookings: [{ barberId: 1, start: ist("11:00"), end: ist("11:30"), status: "approved" }],
    });
    expect(starts(i)).toEqual(t("10:00"));
  });

  test("inactive barbers and barbers not offering the service are skipped", () => {
    expect(starts(input({ barbers: [{ id: 1, sort: 1, active: false, serviceIds: [1] }] }))).toEqual([]);
    expect(starts(input({ barbers: [{ id: 1, sort: 1, active: true, serviceIds: [2] }] }))).toEqual([]);
  });

  test("barber availability is clipped to shop hours", () => {
    const i = input({ availability: [{ barberId: 1, weekday: 1, startTime: "09:00", endTime: "11:00" }] });
    expect(starts(i)).toEqual(t("10:00", "10:30"));
  });

  test("min notice and horizon drop slots", () => {
    expect(starts(input({ now: ist("09:30") }))).toEqual(t("10:30", "11:00", "11:30"));
    expect(starts(input({ now: ist("10:00") }))).toEqual(t("11:00", "11:30"));
    const noNotice = { ...input().settings, minNoticeMin: 0 };
    expect(starts(input({ now: ist("10:00"), settings: noNotice }))).toEqual(t("10:00", "10:30", "11:00", "11:30"));
    // 2026-12-14 is a Monday, 42 days out, horizon is 30
    expect(starts(input({ date: "2026-12-14" }))).toEqual([]);
  });

  test("any available: union across barbers, each start lists who is free", () => {
    const i = input({
      barbers: [
        { id: 1, sort: 2, active: true, serviceIds: [1] },
        { id: 2, sort: 1, active: true, serviceIds: [1] },
      ],
      availability: [
        { barberId: 1, weekday: 1, startTime: "10:00", endTime: "12:00" },
        { barberId: 2, weekday: 1, startTime: "10:00", endTime: "12:00" },
      ],
      bookings: [{ barberId: 2, start: ist("10:00"), end: ist("10:30"), status: "pending" }],
    });
    const slots = getSlots(i);
    expect(slots[0].barberIds).toEqual([1]);
    expect(slots[1].barberIds).toEqual([2, 1]); // sorted by barber sort
  });

  test("DST: 09:00 local maps to the right instant on either side of the change", () => {
    const ny = (date: string) => {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      return starts(
        input({
          date,
          settings: { timezone: "America/New_York", slotStepMin: 60, minNoticeMin: 0, horizonDays: 400 },
          now: utc("2026-01-01T00:00:00Z"),
          shopHours: [{ weekday, opens: "09:00", closes: "10:00" }],
          availability: [{ barberId: 1, weekday, startTime: "09:00", endTime: "10:00" }],
        }),
      );
    };
    expect(ny("2026-03-07")).toEqual(["2026-03-07T14:00:00.000Z"]); // EST, UTC-5
    expect(ny("2026-03-09")).toEqual(["2026-03-09T13:00:00.000Z"]); // EDT, UTC-4
    expect(ny("2026-03-08")).toEqual(["2026-03-08T13:00:00.000Z"]); // change day, 09:00 already EDT
  });
});

describe("pickBarber", () => {
  const barbers = [
    { id: 1, sort: 1 },
    { id: 2, sort: 2 },
  ];
  const bk = (barberId: number, h: string, date = "2026-11-02") => ({
    barberId,
    start: ist(h, date),
    end: ist("23:00", date),
    status: "approved" as const,
  });
  test("fewest bookings that day wins, ties go to lowest sort", () => {
    const args = { barberIds: [1, 2], barbers, date: "2026-11-02", timezone: "Asia/Kolkata" };
    expect(pickBarber({ ...args, bookings: [] })).toBe(1);
    expect(pickBarber({ ...args, bookings: [bk(1, "10:00")] })).toBe(2);
    expect(pickBarber({ ...args, bookings: [bk(1, "10:00"), bk(2, "11:00")] })).toBe(1);
    expect(pickBarber({ ...args, bookings: [bk(1, "10:00", "2026-11-03")] })).toBe(1); // other days do not count
  });
});
