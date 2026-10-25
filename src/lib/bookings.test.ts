import { expect, test } from "vitest";
import { transition } from "./bookings";

test("allowed moves follow the lifecycle table", () => {
  expect(transition("pending", "approved", "barber")).toBe("approved");
  expect(transition("pending", "approved", "admin")).toBe("approved");
  expect(transition("pending", "rejected", "barber")).toBe("rejected");
  expect(transition("pending", "expired", "system")).toBe("expired");
  expect(transition("pending", "cancelled", "customer")).toBe("cancelled");
  expect(transition("approved", "cancelled", "customer")).toBe("cancelled");
  expect(transition("approved", "cancelled", "admin")).toBe("cancelled");
});

test("illegal moves throw", () => {
  expect(() => transition("rejected", "approved", "admin")).toThrow();
  expect(() => transition("expired", "approved", "barber")).toThrow();
  expect(() => transition("cancelled", "pending", "admin")).toThrow();
  expect(() => transition("approved", "rejected", "barber")).toThrow();
  expect(() => transition("pending", "approved", "customer")).toThrow(); // wrong actor
  expect(() => transition("pending", "expired", "admin")).toThrow();
});
