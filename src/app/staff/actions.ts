"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import { notifyDecision } from "@/lib/notify";
import { siteUrl } from "@/lib/site";
import { requireActionRole } from "@/lib/session";
import { decideBooking } from "@/lib/staff-service";

export async function decide(fd: FormData) {
  const actor = await requireActionRole(["barber", "admin"]);
  const decision = fd.get("decision");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Bad decision");
  const db = await getDb();
  const id = Number(fd.get("id"));
  await decideBooking(db, actor, id, decision, String(fd.get("reason") ?? ""));
  after(() => notifyDecision(db, id, decision, { siteUrl: siteUrl() }));
  revalidatePath("/staff");
}
