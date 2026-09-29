import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./session";

export interface CurrentUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  roleId: number | null;
  roleName: string | null;
  permissions: Set<string>;
  isAdmin: boolean;
  /** are autentificare în doi pași configurată (condiție pentru stratul financiar) */
  totpEnabled: boolean;
}

/** Utilizatorul curent (cache per-request). null dacă nu e logat. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.staffId) return null;
  const staff = await prisma.staff.findUnique({
    where: { id: session.staffId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!staff || !staff.active) return null;
  const roleName = staff.role?.name ?? null;
  const isAdmin = roleName === "admin" || roleName === "Administrator";
  const permissions = new Set(
    staff.role?.permissions.map((rp) => rp.permission.name) ?? []
  );
  return {
    id: staff.id,
    username: staff.username,
    firstName: staff.firstName,
    lastName: staff.lastName,
    fullName: `${staff.firstName} ${staff.lastName}`.trim(),
    email: staff.email,
    roleId: staff.roleId,
    roleName,
    permissions,
    isAdmin,
    totpEnabled: staff.totpEnabledAt != null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/auth/login");
  return user;
}

export function can(user: CurrentUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.permissions.has(permission);
}

export async function requirePermission(permission: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) {
    throw new Error(`Nu ai permisiunea necesară (${permission}).`);
  }
  return user;
}
