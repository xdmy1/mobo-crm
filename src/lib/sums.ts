// Sursa UNICĂ pentru „cât valorează” un proiect / o cameră / un client / tot portofoliul.
// Orice pagină care arată o valoare trece pe aici, ca cifrele să nu difere între taburi.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface MoneyPair {
  eur: number;
  lei: number;
}

/**
 * O estimare „contează” doar dacă e activă, neștearsă și proiectul ei există.
 * (Variantele duplicate sunt inactive, deci nu dublează valoarea proiectului.)
 */
export const COUNTED_QUOTE = {
  deletedAt: null,
  active: true,
  opportunity: { deletedAt: null },
} satisfies Prisma.QuoteWhereInput;

type QuoteMoney = { totalPrice: number; offerPriceEur: number; discountEur: number };

/** Totalul unui set de estimări deja încărcate (după reducere). */
export function sumQuotes(quotes: QuoteMoney[]): MoneyPair {
  let lei = 0;
  let eur = 0;
  for (const q of quotes) {
    lei += q.totalPrice;
    eur += Math.max(0, q.offerPriceEur - q.discountEur);
  }
  return { eur: round2(eur), lei: round2(lei) };
}

/** Dintr-o listă de estimări, doar cele care contează la valoare. */
export function countedQuotes<T extends { active: boolean; deletedAt: Date | null }>(quotes: T[]): T[] {
  return quotes.filter((q) => q.active && !q.deletedAt);
}

export async function quoteTotals(where: Prisma.QuoteWhereInput = {}): Promise<MoneyPair> {
  const { opportunity, ...rest } = where;
  const quotes = await prisma.quote.findMany({
    where: {
      ...rest,
      deletedAt: null,
      active: true,
      opportunity: { ...(opportunity as Prisma.OpportunityWhereInput | undefined), deletedAt: null },
    },
    select: { totalPrice: true, offerPriceEur: true, discountEur: true },
  });
  return sumQuotes(quotes);
}

/** Suma unui proiect = suma estimărilor lui active (total după reducere). */
export const opportunitySum = (opportunityId: number) => quoteTotals({ opportunityId });

/** Suma unei camere = suma proiectelor din cameră. */
export const roomSum = (roomId: number) => quoteTotals({ opportunity: { roomId } });

/** Suma unui client = suma tuturor proiectelor lui. */
export const contactSum = (contactId: number) => quoteTotals({ opportunity: { contactId } });

/** Valoarea întregului portofoliu (dashboard). */
export const portfolioSum = () => quoteTotals();

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
