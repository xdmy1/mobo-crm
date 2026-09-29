// Stratul financiar (Bord Finanțe, plăți, account-uri, tranzacții, rapoarte contabile, backup)
// se deschide doar cu: permisiunea modulului + 2FA configurat + sesiune deblocată recent
// (parolă + cod din aplicație). Fără deblocare, și administratorul vede exact cât un angajat obișnuit.
//
// Filtrarea e pe server: paginile nu încarcă datele, acțiunile refuză, iar export/backup răspund 403.

import { cache } from "react";
import { getSession } from "./session";
import { can, type CurrentUser } from "./auth";
import { FINANCE_UNLOCK_MINUTES, type FinanceLockReason } from "./financeShared";

export { FINANCE_UNLOCK_MINUTES };
export type { FinanceLockReason };

/** modulele de permisiuni care fac parte din stratul financiar (CRUD-ul generic le cere deblocarea) */
export const FINANCE_MODULES: ReadonlySet<string> = new Set(["finances", "account", "transaction"]);

/** oricare dintre acestea dă dreptul de a debloca stratul financiar (restul e decis per pagină/acțiune) */
export const FINANCE_VIEW_PERMISSIONS = ["readAll-finances", "readAll-account", "readAll-transaction"] as const;

export function hasFinancePermission(user: CurrentUser | null): boolean {
  return FINANCE_VIEW_PERMISSIONS.some((p) => can(user, p));
}

export interface FinanceAccess {
  allowed: boolean;
  reason: FinanceLockReason | null;
  /** epoch ms până când rămâne deblocat (doar când `allowed`) */
  until: number | null;
  totpEnabled: boolean;
}

/** Momentul până la care sesiunea curentă e deblocată, sau null (cache per request). */
export const financeUnlockedUntil = cache(async (): Promise<number | null> => {
  const session = await getSession();
  const until = session.financeUntil;
  return until != null && until > Date.now() ? until : null;
});

export async function financeAccess(
  user: CurrentUser | null,
  permission = "readAll-finances"
): Promise<FinanceAccess> {
  if (!user || !can(user, permission))
    return { allowed: false, reason: "no-permission", until: null, totpEnabled: !!user?.totpEnabled };
  if (!user.totpEnabled) return { allowed: false, reason: "no-2fa", until: null, totpEnabled: false };
  const until = await financeUnlockedUntil();
  if (!until) return { allowed: false, reason: "locked", until: null, totpEnabled: true };
  return { allowed: true, reason: null, until, totpEnabled: true };
}

/** Mesajul de refuz pentru acțiuni/rute (ActionResult.error sau 403). */
export function financeLockedMessage(a: FinanceAccess): string {
  switch (a.reason) {
    case "no-permission":
      return "Nu ai permisiunea necesară.";
    case "no-2fa":
      return "Stratul financiar cere autentificare în doi pași. Configureaz-o din Securitate cont.";
    default:
      return "Stratul financiar e blocat. Deblochează-l cu parola și codul 2FA.";
  }
}
