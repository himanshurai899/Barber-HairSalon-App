"use server";

import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireActionRole } from "@/lib/session";
import { changeOwnPassword } from "@/lib/users";

/** Any signed-in user (admin or barber), only for their own login. */
export async function changePasswordAction(_: { error?: string; ok?: boolean } | null, fd: FormData) {
  const actor = await requireActionRole(["admin", "barber"]);
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { error: "The two new passwords do not match." };
  try {
    const r = await changeOwnPassword(await getDb(), await getAuth(), actor, String(fd.get("current") ?? ""), next);
    return r.ok ? { ok: true } : { error: r.error };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
