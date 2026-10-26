"use server";

import { revalidatePath } from "next/cache";
import { createManualBooking, deleteBooking, deleteNotice, editBooking, overrideStatus, saveNotice, saveSettings } from "@/lib/admin-bookings";
import type { BookingStatus } from "@/lib/db/schema";
import {
  addSpecialHours,
  addTimeOff,
  deleteBarber,
  deleteService,
  deleteSpecialHours,
  deleteTimeOff,
  saveAvailability,
  saveBarber,
  saveService,
  saveShopHours,
} from "@/lib/admin-service";
import type { Actor } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db";
import { requireActionRole } from "@/lib/session";

type State = { error?: string; ok?: boolean } | null;

async function run(path: string, fn: (db: Db, actor: Actor) => Promise<unknown>): Promise<State> {
  const actor = await requireActionRole(["admin"]); // throws for anyone else
  try {
    const r = (await fn(await getDb(), actor)) as { ok?: boolean; error?: string } | undefined;
    if (r && r.ok === false) return { error: r.error ?? "Could not save." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath(path);
  revalidatePath("/");
  revalidatePath("/services");
  return { ok: true };
}

/** Empty form fields become undefined so optional validation applies. */
function val(fd: FormData, k: string) {
  const v = fd.get(k);
  return v === null || v === "" ? undefined : String(v);
}
const on = (fd: FormData, k: string) => fd.get(k) === "on";
const lines = (fd: FormData) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, String(fd.get(`day${d}`) ?? "")]));

export async function saveServiceAction(_: State, fd: FormData) {
  return run("/admin/services", (db, actor) =>
    saveService(db, actor, {
      id: val(fd, "id"), name: fd.get("name"), category: val(fd, "category"), durationMin: fd.get("durationMin"),
      price: fd.get("price"), sort: val(fd, "sort"), active: on(fd, "active"),
    }),
  );
}

export async function saveBarberAction(_: State, fd: FormData) {
  return run("/admin/barbers", (db, actor) =>
    saveBarber(db, actor, {
      id: val(fd, "id"), name: fd.get("name"), phone: val(fd, "phone"), photoUrl: val(fd, "photoUrl"), bio: val(fd, "bio"),
      instagram: val(fd, "instagram"), sort: val(fd, "sort"), active: on(fd, "active"), serviceIds: fd.getAll("serviceIds"),
    }),
  );
}

export async function saveShopHoursAction(_: State, fd: FormData) {
  return run("/admin/hours", (db, actor) => saveShopHours(db, actor, lines(fd)));
}

export async function addSpecialHoursAction(_: State, fd: FormData) {
  return run("/admin/hours", (db, actor) =>
    addSpecialHours(db, actor, {
      id: val(fd, "id"), startsOn: fd.get("startsOn"), endsOn: fd.get("endsOn"), opens: val(fd, "opens"), closes: val(fd, "closes"),
      closed: on(fd, "closed"), label: val(fd, "label"),
    }),
  );
}

export async function deleteSpecialHoursAction(fd: FormData) {
  await run("/admin/hours", (db, actor) => deleteSpecialHours(db, actor, Number(fd.get("id"))));
}

export async function saveAvailabilityAction(_: State, fd: FormData) {
  return run("/admin/barbers", (db, actor) => saveAvailability(db, actor, Number(fd.get("barberId")), lines(fd)));
}

export async function addTimeOffAction(_: State, fd: FormData) {
  return run("/admin/barbers", (db, actor) =>
    addTimeOff(db, actor, { id: val(fd, "id"), barberId: fd.get("barberId"), from: fd.get("from"), to: fd.get("to"), reason: val(fd, "reason") }),
  );
}

export async function deleteTimeOffAction(fd: FormData) {
  await run("/admin/barbers", (db, actor) => deleteTimeOff(db, actor, Number(fd.get("id"))));
}

export async function manualBookingAction(_: State, fd: FormData) {
  return run("/admin/bookings", (db, actor) =>
    createManualBooking(db, actor, {
      serviceIds: fd.getAll("serviceIds"), barberId: fd.get("barberId"), date: fd.get("date"), time: fd.get("time"),
      name: fd.get("name"), phone: fd.get("phone"), source: fd.get("source"), note: val(fd, "note"),
    }),
  );
}

export async function editBookingAction(_: State, fd: FormData) {
  return run("/admin/bookings", (db, actor) =>
    editBooking(db, actor, {
      id: fd.get("id"), serviceIds: fd.getAll("serviceIds"), barberId: fd.get("barberId"), date: fd.get("date"), time: fd.get("time"),
      name: fd.get("name"), phone: fd.get("phone"), note: val(fd, "note"),
    }),
  );
}

export async function deleteBookingAction(_: State, fd: FormData) {
  return run("/admin/bookings", (db, actor) => deleteBooking(db, actor, Number(fd.get("id"))));
}

export async function overrideStatusAction(_: State, fd: FormData) {
  return run("/admin/bookings", (db, actor) => overrideStatus(db, actor, Number(fd.get("id")), String(fd.get("status")) as BookingStatus));
}

export async function saveNoticeAction(_: State, fd: FormData) {
  return run("/admin/notices", (db, actor) =>
    saveNotice(db, actor, {
      id: val(fd, "id"), kind: fd.get("kind"), title: fd.get("title"), body: val(fd, "body"), badge: val(fd, "badge"),
      startsOn: val(fd, "startsOn"), endsOn: val(fd, "endsOn"), active: on(fd, "active"), sort: val(fd, "sort"),
    }),
  );
}

export async function deleteNoticeAction(fd: FormData) {
  await run("/admin/notices", (db, actor) => deleteNotice(db, actor, Number(fd.get("id"))));
}

export async function saveSettingsAction(_: State, fd: FormData) {
  const keys = ["name", "tagline", "address", "lat", "lng", "mapsPlaceId", "phone", "whatsappNumber", "timezone", "currency", "greetingText", "pendingTtlMin", "slotStepMin", "minNoticeMin", "horizonDays", "maxOpenPerPhone"];
  return run("/admin/settings", (db, actor) => saveSettings(db, actor, Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]))));
}

export async function deleteServiceAction(_: State, fd: FormData) {
  return run("/admin/services", (db, actor) => deleteService(db, actor, Number(fd.get("id"))));
}

export async function deleteBarberAction(_: State, fd: FormData) {
  return run("/admin/barbers", (db, actor) => deleteBarber(db, actor, Number(fd.get("id"))));
}
