"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createBooking } from "@/lib/booking-service";
import { getDb } from "@/lib/db";
import { notifyNewRequest } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

export type BookingFormState = { error?: string; name?: string; phone?: string } | null;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function submitBooking(_prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const db = await getDb();
  const r = await createBooking(db, {
    serviceIds: str(fd, "services").split(",").filter(Boolean) as unknown as number[], // zod coerces the ids
    barber: str(fd, "barber") as "any",
    date: str(fd, "date"),
    time: str(fd, "time"),
    name,
    phone,
    waOptIn: fd.get("waOptIn") === "on",
    website: str(fd, "website"),
    source: str(fd, "source") === "whatsapp" ? "whatsapp" : "web",
  });
  if (!r.ok) return { error: r.message, name, phone };
  if (r.created) after(() => notifyNewRequest(db, r.id, { siteUrl: siteUrl() })); // after the response, never blocks or rolls back
  redirect(`/b/${r.token}`);
}
