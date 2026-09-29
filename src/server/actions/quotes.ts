"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { computeQuote, type QuoteConfig } from "@/lib/calc/engine";
import { quoteTitle } from "@/lib/format";
import { advanceContactTo, deactivateSiblingQuotes } from "@/server/workflow";
import type { ActionResult } from "@/lib/listTypes";
import type { Prisma } from "@prisma/client";

/** Salvează estimarea din wizard (creare sau re-editare). */
export async function saveQuoteFromWizard(
  opportunityId: number,
  quoteId: number | null,
  config: QuoteConfig
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, quoteId ? "update-quote" : "create-quote"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });
  if (!opportunity) return { ok: false, error: "Proiect inexistent." };

  const catalog = await getActiveCatalog();
  const r = computeQuote(config, catalog);
  const name = quoteTitle(r.totalMdl);

  const data = {
    name,
    opportunityId,
    staffId: user.id,
    quoteDate: new Date(),
    expirationDate: new Date(Date.now() + 30 * 86400000),
    totalPrice: r.totalMdl,
    minPriceEur: r.minPriceEur,
    minPriceMdl: r.minPriceMdl,
    offerPriceEur: r.offerPriceEur,
    offerPriceMdl: r.offerPriceMdl,
    discountEur: r.appliedDiscountMdl > 0 ? r.appliedDiscountMdl / catalog.cursEuro : 0,
    config: config as unknown as Prisma.InputJsonValue,
    active: true,
  };

  let id = quoteId;
  if (quoteId) {
    await prisma.quote.update({ where: { id: quoteId }, data });
  } else {
    const created = await prisma.quote.create({ data });
    id = created.id;
    // estimarea nouă devine cea care contează la valoarea proiectului (fără dublări)
    await deactivateSiblingQuotes(opportunityId, created.id);
  }

  // o estimare cu preț dovedește etapa „Calcule”
  if (opportunity.contactId && r.totalMdl > 0)
    await advanceContactTo(opportunity.contactId, "Calcule", user.id, "estimare salvată");

  // istoric versiuni [NOU]
  await prisma.quoteVersion.create({
    data: {
      quoteId: id!,
      config: config as unknown as Prisma.InputJsonValue,
      prices: {
        minPriceMdl: r.minPriceMdl,
        offerPriceMdl: r.offerPriceMdl,
        totalMdl: r.totalMdl,
        discountMdl: r.appliedDiscountMdl,
      },
      staffId: user.id,
    },
  });

  if (opportunity.staffId && opportunity.staffId !== user.id) {
    await notify(
      opportunity.staffId,
      `Estimare ${quoteId ? "actualizată" : "nouă"} pentru proiectul „${opportunity.name}”: ${name}.`,
      `/admin/quote/${id}`
    );
  }
  await audit(user.id, quoteId ? "update" : "create", "quote", id);
  revalidatePath("/admin", "layout");
  return { ok: true, id: id ?? undefined, redirect: `/admin/quote/${id}` };
}

/** Salvează reducerea (€) pe pagina estimării, limitată la maximul permis. */
export async function saveQuoteDiscount(
  quoteId: number,
  discountEur: number
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-quote"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return { ok: false, error: "Estimare inexistentă." };

  const catalog = await getActiveCatalog();
  const maxEur = Math.max(0, quote.offerPriceEur - quote.minPriceEur);
  const applied = Math.min(Math.max(0, discountEur), maxEur);
  const totalMdl = Math.max(
    quote.minPriceMdl,
    quote.offerPriceMdl - applied * catalog.cursEuro
  );

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      discountEur: applied,
      totalPrice: Math.round(totalMdl * 100) / 100,
      name: totalMdl > 0 ? quoteTitle(totalMdl) : quote.name,
    },
  });
  await audit(user.id, "discount", "quote", quoteId, { discountEur: applied });
  revalidatePath(`/admin/quote/${quoteId}`);
  revalidatePath("/admin/quote");
  return { ok: true };
}

export async function deleteQuote(quoteId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "delete-quote"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data: { deletedAt: new Date() },
  });
  await audit(user.id, "delete", "quote", quoteId);
  revalidatePath("/admin", "layout");
  // înapoi în proiectul din care făcea parte, nu în lista generală
  return { ok: true, redirect: `/admin/opportunity/${quote.opportunityId}` };
}

/** Duplică estimarea [NOU]. */
export async function duplicateQuote(quoteId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-quote"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  const q = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!q) return { ok: false, error: "Estimare inexistentă." };
  const copy = await prisma.quote.create({
    data: {
      name: `${q.name} (copie)`,
      opportunityId: q.opportunityId,
      staffId: user.id,
      quoteDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 86400000),
      totalPrice: q.totalPrice,
      minPriceEur: q.minPriceEur,
      minPriceMdl: q.minPriceMdl,
      offerPriceEur: q.offerPriceEur,
      offerPriceMdl: q.offerPriceMdl,
      discountEur: q.discountEur,
      config: (q.config ?? undefined) as Prisma.InputJsonValue | undefined,
      // copia e o VARIANTĂ: nu intră la valoarea proiectului până nu e activată
      active: false,
    },
  });
  await audit(user.id, "duplicate", "quote", copy.id, { from: quoteId });
  revalidatePath("/admin/quote");
  return { ok: true, id: copy.id, redirect: `/admin/quote/${copy.id}` };
}
