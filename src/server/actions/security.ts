"use server";

// Securitatea contului: autentificare în doi pași (TOTP) și deblocarea stratului financiar.
// Fiecare deblocare, blocare, activare/dezactivare 2FA și fiecare încercare eșuată ajung în jurnalul de audit.

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { FINANCE_UNLOCK_MINUTES, hasFinancePermission } from "@/lib/financeAccess";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from "@/lib/totp";
import type { ActionResult } from "@/lib/listTypes";

/* ───────────── rate-limit în memorie: 5 încercări greșite → 5 minute pauză ───────────── */

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map<number, { fails: number; lockedUntil: number }>();

function throttled(staffId: number): string | null {
  const a = attempts.get(staffId);
  if (!a) return null;
  if (a.lockedUntil > Date.now()) {
    const min = Math.ceil((a.lockedUntil - Date.now()) / 60000);
    return `Prea multe încercări greșite. Reîncearcă peste ${min} ${min === 1 ? "minut" : "minute"}.`;
  }
  return null;
}
function recordFail(staffId: number) {
  const a = attempts.get(staffId) ?? { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.fails = 0;
    a.lockedUntil = Date.now() + LOCK_MS;
  }
  attempts.set(staffId, a);
}
function clearFails(staffId: number) {
  attempts.delete(staffId);
}

export interface Credentials {
  password: string;
  code: string;
}

type Verified = { ok: true; usedRecovery: boolean } | { ok: false; error: string };

/**
 * Parola + codul din aplicație (sau un cod de recuperare). Sursa unică pentru tot ce e sensibil:
 * deblocarea finanțelor, dezactivarea 2FA, regenerarea codurilor.
 */
async function verifyCredentials(staffId: number, { password, code }: Credentials): Promise<Verified> {
  const wait = throttled(staffId);
  if (wait) return { ok: false, error: wait };

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) return { ok: false, error: "Utilizator inexistent." };
  if (!password) return { ok: false, error: "Introdu parola." };
  if (!(await bcrypt.compare(password, staff.passwordHash))) {
    recordFail(staffId);
    return { ok: false, error: "Parolă incorectă." };
  }
  if (!staff.totpSecret || !staff.totpEnabledAt)
    return { ok: false, error: "Autentificarea în doi pași nu e configurată." };

  const clean = code.trim();
  if (/^\d{6}$/.test(clean.replace(/\s+/g, ""))) {
    const step = verifyTotp(decryptSecret(staff.totpSecret), clean, { lastStep: staff.totpLastStep });
    if (step == null) {
      recordFail(staffId);
      return { ok: false, error: "Cod 2FA incorect sau deja folosit." };
    }
    await prisma.staff.update({ where: { id: staffId }, data: { totpLastStep: step } });
    clearFails(staffId);
    return { ok: true, usedRecovery: false };
  }
  if (looksLikeRecoveryCode(clean)) {
    const h = hashRecoveryCode(clean);
    if (!staff.totpRecoveryCodes.includes(h)) {
      recordFail(staffId);
      return { ok: false, error: "Cod de recuperare invalid sau deja folosit." };
    }
    // un cod de recuperare se consumă la prima folosire
    await prisma.staff.update({
      where: { id: staffId },
      data: { totpRecoveryCodes: staff.totpRecoveryCodes.filter((x) => x !== h) },
    });
    clearFails(staffId);
    return { ok: true, usedRecovery: true };
  }
  return { ok: false, error: "Introdu codul de 6 cifre din aplicație sau un cod de recuperare." };
}

/* ───────────── stratul financiar ───────────── */

export async function unlockFinances(input: Credentials): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!hasFinancePermission(user)) return { ok: false, error: "Nu ai permisiunea necesară." };
  if (!user.totpEnabled)
    return { ok: false, error: "Configurează mai întâi autentificarea în doi pași (Securitate cont)." };

  const v = await verifyCredentials(user.id, input);
  if (!v.ok) {
    await audit(user.id, "finance-unlock-failed", "finance", null, { reason: v.error });
    return { ok: false, error: v.error };
  }

  const session = await getSession();
  const until = Date.now() + FINANCE_UNLOCK_MINUTES * 60 * 1000;
  session.financeUntil = until;
  await session.save();
  await audit(user.id, "finance-unlock", "finance", null, {
    minutes: FINANCE_UNLOCK_MINUTES,
    recoveryCode: v.usedRecovery,
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function lockFinances(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const session = await getSession();
  const wasUnlocked = session.financeUntil != null && session.financeUntil > Date.now();
  session.financeUntil = undefined;
  await session.save();
  if (wasUnlocked) await audit(user.id, "finance-lock", "finance");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ───────────── configurarea 2FA ───────────── */

export type TotpSetupStart =
  | { ok: true; secret: string; qrDataUrl: string }
  | { ok: false; error: string };

/** Pasul 1: secret nou + cod QR. Secretul stă în sesiune până e confirmat cu un cod valid. */
export async function beginTotpSetup(): Promise<TotpSetupStart> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (user.totpEnabled)
    return { ok: false, error: "2FA e deja activ. Dezactivează-l înainte de a-l reconfigura." };
  const secret = generateSecret();
  const session = await getSession();
  session.pendingTotp = secret;
  await session.save();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl(secret, user.username), { margin: 1, width: 220 });
  return { ok: true, secret, qrDataUrl };
}

export type TotpConfirm =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; error: string };

/** Pasul 2: primul cod din aplicație confirmă că telefonul e configurat corect. */
export async function confirmTotpSetup(code: string): Promise<TotpConfirm> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const session = await getSession();
  const pending = session.pendingTotp;
  if (!pending) return { ok: false, error: "Configurarea a expirat. Pornește din nou." };
  const step = verifyTotp(pending, code);
  if (step == null) return { ok: false, error: "Codul nu se potrivește. Verifică ora telefonului și încearcă din nou." };

  const codes = generateRecoveryCodes();
  await prisma.staff.update({
    where: { id: user.id },
    data: {
      totpSecret: encryptSecret(pending),
      totpEnabledAt: new Date(),
      totpLastStep: step,
      totpRecoveryCodes: codes.map(hashRecoveryCode),
    },
  });
  session.pendingTotp = undefined;
  await session.save();
  await audit(user.id, "2fa-enable", "staff", user.id);
  revalidatePath("/admin", "layout");
  return { ok: true, recoveryCodes: codes };
}

export async function disableTotp(input: Credentials): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const v = await verifyCredentials(user.id, input);
  if (!v.ok) return { ok: false, error: v.error };
  await prisma.staff.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: [] },
  });
  const session = await getSession();
  session.financeUntil = undefined;
  await session.save();
  await audit(user.id, "2fa-disable", "staff", user.id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function regenerateRecoveryCodes(input: Credentials): Promise<TotpConfirm> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const v = await verifyCredentials(user.id, input);
  if (!v.ok) return { ok: false, error: v.error };
  const codes = generateRecoveryCodes();
  await prisma.staff.update({
    where: { id: user.id },
    data: { totpRecoveryCodes: codes.map(hashRecoveryCode) },
  });
  await audit(user.id, "2fa-recovery-regenerate", "staff", user.id);
  return { ok: true, recoveryCodes: codes };
}

/** Un administrator poate scoate 2FA-ul unui coleg care și-a pierdut telefonul (nu al lui însuși). */
export async function resetStaffTotp(staffId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!user.isAdmin) return { ok: false, error: "Doar administratorul poate reseta 2FA." };
  if (staffId === user.id)
    return { ok: false, error: "Pentru contul tău folosește „Dezactivează 2FA” (cu parolă și cod)." };
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, username: true } });
  if (!staff) return { ok: false, error: "Angajat inexistent." };
  await prisma.staff.update({
    where: { id: staffId },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: [] },
  });
  await audit(user.id, "2fa-reset", "staff", staffId, { username: staff.username });
  revalidatePath("/admin/security");
  return { ok: true };
}
