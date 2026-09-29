// Constante și tipuri ale stratului financiar folosite și pe client (fără importuri de server).

export const FINANCE_UNLOCK_MINUTES = 15;

export type FinanceLockReason = "no-permission" | "no-2fa" | "locked";

/** ce știe scheletul aplicației despre stratul financiar al utilizatorului curent */
export interface FinanceShellState {
  /** are vreo permisiune financiară (poate debloca) */
  hasPermission: boolean;
  totpEnabled: boolean;
  /** epoch ms până când e deblocat, sau null dacă e blocat */
  unlockedUntil: number | null;
}
