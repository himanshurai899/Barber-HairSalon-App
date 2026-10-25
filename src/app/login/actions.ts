"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export async function login(_prev: { error?: string } | null, fd: FormData) {
  const auth = await getAuth();
  let role: string | undefined;
  try {
    const res = await auth.api.signInEmail({
      body: { email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") },
      headers: await headers(),
    });
    role = (res.user as { role?: string }).role;
  } catch (e) {
    if (e instanceof APIError) return { error: "Wrong email or password." };
    throw e;
  }
  redirect(role === "admin" ? "/admin" : "/staff");
}

export async function logout() {
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
