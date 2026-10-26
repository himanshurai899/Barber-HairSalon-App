import { expect, test } from "vitest";
import { selectionSummary, whatsappLink } from "./format";

test("running total: count, time and price", () => {
  const cut = { durationMin: 30, priceMinor: 20000 };
  const beard = { durationMin: 45, priceMinor: 25000 };
  expect(selectionSummary([cut, beard], "INR")).toBe("2 services, 1 h 15 min, ₹450");
  expect(selectionSummary([cut], "INR")).toBe("1 service, 30 min, ₹200");
  expect(selectionSummary([{ durationMin: 120, priceMinor: 0 }], "INR")).toBe("1 service, 2 h"); // price hidden when every price is 0
  expect(selectionSummary([cut, { durationMin: 15, priceMinor: 0 }], "INR")).toBe("2 services, 45 min, ₹200");
  expect(selectionSummary([], "INR")).toBe("No services selected");
});

test("whatsappLink opens the chat with a booking message", () => {
  const url = new URL(whatsappLink("+91 99134 07166", "Krishna Hair Salon"));
  expect(url.origin + url.pathname).toBe("https://wa.me/919913407166");
  expect(url.searchParams.get("text")).toBe("Hi Krishna Hair Salon, I'd like to book an appointment.");
});
