// Poarta paginilor financiare (server): permisiune → 2FA → sesiune deblocată.
// Fără permisiune: redirect (pagina nu există pentru acel angajat). Cu permisiune dar blocat: gate-ul.

import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { financeAccess } from "@/lib/financeAccess";
import { FinanceGate } from "./FinanceGate";

export async function guardFinancePage(
  permission: string,
  title: string
): Promise<{ user: CurrentUser; gate: null } | { user: CurrentUser; gate: ReactElement }> {
  const user = await requireUser();
  const access = await financeAccess(user, permission);
  if (access.reason === "no-permission") redirect("/admin/dashboard");
  if (!access.allowed) return { user, gate: <FinanceGate title={title} totpEnabled={access.totpEnabled} /> };
  return { user, gate: null };
}
