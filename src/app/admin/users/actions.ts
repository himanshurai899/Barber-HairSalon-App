"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireActionRole } from "@/lib/session";
import { createStaffUser } from "@/lib/users";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "barber"]),
  barberId: z.coerce.number().int().positive().optional(),
});

export async function createLogin(_prev: { error?: string; ok?: boolean } | null, fd: FormData) {
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
