"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireActionRole } from "@/lib/session";
import { decideBooking } from "@/lib/staff-service";

export async function decide(fd: FormData) {
  const actor = await requireActionRole(["barber", "admin"]);
  const decision = fd.get("decision");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Bad decision");
  await decideBooking(await getDb(), actor, Number(fd.get("id")), decision, String(fd.get("reason") ?? ""));
  revalidatePath("/staff");
}
