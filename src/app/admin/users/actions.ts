"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireActionRole } from "@/lib/session";
import { createStaffUser, deleteStaffUser, resetStaffPassword, updateStaffUser } from "@/lib/users";

type State = { error?: string; ok?: boolean } | null;

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "barber"]),
  barberId: z.coerce.number().int().positive().optional(),
});

export async function createLogin(_prev: State, fd: FormData) {
  await requireActionRole(["admin"]);
  const parsed = schema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    password: fd.get("password"),
    role: fd.get("role"),
    barberId: fd.get("barberId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await createStaffUser(await getDb(), await getAuth(), parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the login." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Runs a staff-management call as the signed-in admin and turns failures into form errors. */
async function manage(fn: (actor: Awaited<ReturnType<typeof requireActionRole>>) => Promise<{ ok: true } | { ok: false; error: string }>): Promise<State> {
  const actor = await requireActionRole(["admin"]); // throws for anyone else
  try {
    const r = await fn(actor);
    if (!r.ok) return { error: r.error };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateLoginAction(_: State, fd: FormData) {
  return manage(async (actor) =>
    updateStaffUser(await getDb(), actor, { id: fd.get("id"), name: fd.get("name"), role: fd.get("role"), barberId: fd.get("barberId") || null }),
  );
}

export async function resetPasswordAction(_: State, fd: FormData) {
  return manage(async (actor) => resetStaffPassword(await getDb(), await getAuth(), actor, String(fd.get("id")), String(fd.get("password") ?? "")));
}

export async function deleteLoginAction(_: State, fd: FormData) {
  return manage(async (actor) => deleteStaffUser(await getDb(), actor, String(fd.get("id"))));
}
