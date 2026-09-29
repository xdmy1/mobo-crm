"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/listTypes";

export async function createRole(name: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-role"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  if (!name.trim()) return { ok: false, error: "Numele rolului este obligatoriu." };
  try {
    const role = await prisma.role.create({ data: { name: name.trim() } });
    await audit(user.id, "create", "role", role.id);
    revalidatePath("/admin/setup/role");
    return { ok: true, id: role.id };
  } catch {
    return { ok: false, error: "Există deja un rol cu acest nume." };
  }
}

export async function deleteRole(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "delete-role"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  const staffCount = await prisma.staff.count({ where: { roleId: id } });
  if (staffCount > 0)
    return {
      ok: false,
      error: `Rolul este folosit de ${staffCount} angajați. Reasignează-i mai întâi.`,
    };
  await prisma.role.delete({ where: { id } });
  await audit(user.id, "delete", "role", id);
  revalidatePath("/admin/setup/role");
  return { ok: true, redirect: "/admin/setup/role" };
}

/** Bifează/debifează un set de permisiuni pentru rol (matricea vizuală [NOU]). */
export async function setRolePermissions(
  roleId: number,
  permissionNames: string[],
  grant: boolean
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-rolePermission"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const perms = await prisma.permission.findMany({
    where: { name: { in: permissionNames } },
  });
  if (grant) {
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  } else {
    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: perms.map((p) => p.id) } },
    });
  }
  await audit(user.id, grant ? "grant" : "revoke", "rolePermission", roleId, {
    permissions: permissionNames,
  });
  revalidatePath(`/admin/setup/role/${roleId}`);
  return { ok: true };
}
