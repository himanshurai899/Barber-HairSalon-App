"use server";

import { redirect } from "next/navigation";
import { createBooking } from "@/lib/booking-service";
import { getDb } from "@/lib/db";

export type BookingFormState = { error?: string; name?: string; phone?: string } | null;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function submitBooking(_prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const r = await createBooking(await getDb(), {
    serviceId: str(fd, "service") as unknown as number,
    barber: str(fd, "barber") as "any",
    date: str(fd, "date"),
    time: str(fd, "time"),
    name,
    phone,
    waOptIn: fd.get("waOptIn") === "on",
    website: str(fd, "website"),
  });
  if (!r.ok) return { error: r.message, name, phone };
  redirect(`/b/${r.token}`);
}
