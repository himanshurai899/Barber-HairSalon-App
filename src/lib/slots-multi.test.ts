import { describe, expect, test } from "vitest";
import { getSlots, type SlotInput } from "./slots";

// 2026-11-02 is a Monday. Asia/Kolkata is UTC+05:30, so 10:00 local = 04:30Z.
const ist = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+05:30`).toISOString();

function input(over: Partial<SlotInput> = {}): SlotInput {
  return {
    date: "2026-11-02",
    services: [{ id: 1, durationMin: 30 }, { id: 2, durationMin: 15 }],
    barbers: [{ id: 1, sort: 1, active: true, serviceIds: [1, 2] }],
    shopHours: [{ weekday: 1, opens: "10:00", closes: "12:00" }],
    specialHours: [],
    availability: [1, 2].map((barberId) => ({ barberId, weekday: 1, startTime: "10:00", endTime: "12:00" })),
    timeOff: [],
    bookings: [],
    settings: { timezone: "Asia/Kolkata", slotStepMin: 30, minNoticeMin: 60, horizonDays: 30 },
    now: new Date("2026-11-01T00:00:00Z"),
    ...over,
  };
}

describe("getSlots with several services", () => {
  test("the booking is as long as the services added together", () => {
    // 45 min in a 10:00-12:00 window, 30 min steps: 11:30 would end at 12:15, so the last start is 11:00
    expect(getSlots(input()).map((s) => s.start.toISOString())).toEqual([ist("10:00"), ist("10:30"), ist("11:00")]);
  });

  test("only barbers who offer every selected service are candidates", () => {
    const barbers = [
      { id: 1, sort: 1, active: true, serviceIds: [1, 2] },
      { id: 2, sort: 2, active: true, serviceIds: [1] },
    ];
    const slots = getSlots(input({ barbers }));
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.barberIds.join() === "1")).toBe(true);
    expect(getSlots(input({ barbers: [barbers[1]] }))).toEqual([]);
  });
});
