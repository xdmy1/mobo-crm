"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { financeAccess, financeLockedMessage } from "@/lib/financeAccess";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/listTypes";

export interface FinanceRowInput {
  contractId: number;
  sinecost: number;
  prodPrice: number;
  contractSumEur: number;
  avans1: number;
  avans2: number;
  avans3: number;
  avansProducere: number;
  transaFinalaProducere: number;
  procentQc: number;
  cadou: number;
  reducere: number;
}

export async function saveFinanceRows(
  rows: FinanceRowInput[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const access = await financeAccess(user, "update-finances");
  if (!access.allowed) return { ok: false, error: financeLockedMessage(access) };

  for (const r of rows) {
    await prisma.contractFinance.upsert({
      where: { contractId: r.contractId },
      update: {
        sinecost: r.sinecost,
        prodPrice: r.prodPrice,
        contractSumEur: r.contractSumEur,
        avans1: r.avans1,
        avans2: r.avans2,
        avans3: r.avans3,
        avansProducere: r.avansProducere,
        transaFinalaProducere: r.transaFinalaProducere,
        procentQc: r.procentQc,
        cadou: r.cadou,
        reducere: r.reducere,
      },
      create: { ...r },
    });
  }
  await audit(user.id, "update", "finances", rows.map((r) => r.contractId).join(","));
  revalidatePath("/admin/finances");
  return { ok: true };
}

export async function addPayment(
  contractId: number,
  data: { date: string; amountEur: number; method?: string; note?: string }
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const access = await financeAccess(user, "update-finances");
  if (!access.allowed) return { ok: false, error: financeLockedMessage(access) };
  await prisma.payment.create({
    data: {
      contractId,
      date: new Date(data.date),
      amountEur: data.amountEur,
      method: data.method,
      note: data.note,
    },
  });
  await audit(user.id, "create", "payment", contractId);
  revalidatePath("/admin/finances");
  return { ok: true };
}

export async function deletePayment(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const access = await financeAccess(user, "update-finances");
  if (!access.allowed) return { ok: false, error: financeLockedMessage(access) };
  await prisma.payment.delete({ where: { id } });
  revalidatePath("/admin/finances");
  return { ok: true };
}
