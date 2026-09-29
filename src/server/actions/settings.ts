"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/mail";
import type { CalcCatalogData } from "@/lib/calc/catalog";
import type { ActionResult } from "@/lib/listTypes";
import type { Prisma } from "@prisma/client";

/** Salvează catalogul de calcule ca versiune nouă (istoric [NOU]). */
export async function saveCatalog(data: CalcCatalogData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-calcSettings"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  await prisma.$transaction([
    prisma.calcCatalog.updateMany({
      where: { active: true },
      data: { active: false },
    }),
    prisma.calcCatalog.create({
      data: {
        active: true,
        data: data as unknown as Prisma.InputJsonValue,
        validFrom: new Date(),
      },
    }),
  ]);
  await audit(user.id, "update", "calcSettings", null, { cursEuro: data.cursEuro });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function saveOrganization(values: {
  name?: string;
  idno?: string;
  vatCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  partnerPercent?: number;
  designerPercent?: number;
  qcDefault?: number;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-organization"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  await prisma.organization.upsert({
    where: { id: 1 },
    update: values,
    create: { id: 1, name: values.name ?? "Mobo kitchens & home", ...values },
  });
  await audit(user.id, "update", "organization", 1);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function saveEmailConfig(values: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  secure?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-setup"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  await prisma.emailConfig.upsert({
    where: { id: 1 },
    update: values,
    create: { id: 1, ...values },
  });
  await audit(user.id, "update", "emailConfig", 1);
  revalidatePath("/admin/setup/email-config");
  return { ok: true };
}

/** Preia cursul oficial EUR/MDL de la BNM (bnm.md) [NOU]. */
export async function fetchBnmRate(): Promise<
  ActionResult & { rate?: number; date?: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  try {
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, "0")}.${String(
      now.getMonth() + 1
    ).padStart(2, "0")}.${now.getFullYear()}`;
    const res = await fetch(
      `https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=${date}`,
      { signal: AbortSignal.timeout(10000), cache: "no-store" }
    );
    if (!res.ok) throw new Error(`BNM a răspuns cu ${res.status}`);
    const xml = await res.text();
    // <CharCode>EUR</CharCode>…<Value>19.xxxx</Value>
    const m = xml.match(
      /<CharCode>EUR<\/CharCode>[\s\S]*?<Value>([\d.,]+)<\/Value>/
    );
    if (!m) throw new Error("Cursul EUR nu a fost găsit în răspunsul BNM.");
    const rate = parseFloat(m[1].replace(",", "."));
    if (!rate || isNaN(rate)) throw new Error("Curs invalid de la BNM.");
    return { ok: true, rate, date };
  } catch (e) {
    return {
      ok: false,
      error: `Nu s-a putut prelua cursul BNM: ${
        e instanceof Error ? e.message : "eroare de rețea"
      }`,
    };
  }
}

export async function sendTestEmail(to: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  try {
    await sendEmail(to, "Test MOBO CRM", "Configurarea SMTP funcționează corect. ✔");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare SMTP" };
  }
}
