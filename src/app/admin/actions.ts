"use server";

import { revalidatePath } from "next/cache";
import {
  addSpecialHours,
  addTimeOff,
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

async function run(path: string, fn: (db: Db, actor: Actor) => Promise<void>): Promise<State> {
  const actor = await requireActionRole(["admin"]); // throws for anyone else
  try {
    await fn(await getDb(), actor);
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
      startsOn: fd.get("startsOn"), endsOn: fd.get("endsOn"), opens: val(fd, "opens"), closes: val(fd, "closes"),
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
    addTimeOff(db, actor, { barberId: fd.get("barberId"), from: fd.get("from"), to: fd.get("to"), reason: val(fd, "reason") }),
  );
}

export async function deleteTimeOffAction(fd: FormData) {
  await run("/admin/barbers", (db, actor) => deleteTimeOff(db, actor, Number(fd.get("id"))));
}
