"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password)
    return { error: "Introduceți numele de utilizator și parola." };

  const staff = await prisma.staff.findUnique({ where: { username } });
  if (!staff || !staff.active)
    return { error: "Utilizator sau parolă incorectă." };
  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return { error: "Utilizator sau parolă incorectă." };

  const session = await getSession();
  session.staffId = staff.id;
  session.username = staff.username;
  await session.save();
  await audit(staff.id, "login", "auth");
  redirect("/admin/calendar");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/auth/login");
}
