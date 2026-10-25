import type { BookingStatus } from "./db/schema";

export type Actor = "customer" | "barber" | "admin" | "system";

// from -> to -> who may do it (design-plan section 8, lifecycle)
const allowed: Partial<Record<BookingStatus, Partial<Record<BookingStatus, Actor[]>>>> = {
  pending: {
    approved: ["barber", "admin"],
    rejected: ["barber", "admin"],
    expired: ["system"],
    cancelled: ["customer"],
  },
  approved: { cancelled: ["customer", "admin"] },
};

/** Returns the new status or throws on an illegal move. */
export function transition(from: BookingStatus, to: BookingStatus, actor: Actor): BookingStatus {
  if (!allowed[from]?.[to]?.includes(actor)) throw new Error(`Illegal booking move ${from} -> ${to} by ${actor}`);
  return to;
}
