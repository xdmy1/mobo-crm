import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { generateQuoteTablePdf } from "@/lib/pdf/generators";
import { personName } from "@/lib/people";
import type { QuoteConfig } from "@/lib/calc/engine";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  const { id } = await ctx.params;
  const quoteId = parseInt(id, 10);

  const [quote, catalog, org] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },
      include: { opportunity: { include: { contact: true } } },
    }),
    getActiveCatalog(),
    prisma.organization.findUnique({ where: { id: 1 } }),
  ]);
  if (!quote) return NextResponse.json({ error: "Negăsit" }, { status: 404 });

  const lang = req.nextUrl.searchParams.get("lang") === "RU" ? "RU" : "RO";
  const pdf = await generateQuoteTablePdf({
    lang,
    org: {
      name: org?.name ?? "Mobo kitchens & home",
      address: org?.address,
      phone: org?.phone,
    },
    quoteName: quote.name,
    projectName: quote.opportunity.name,
    clientName: quote.opportunity.contact ? personName(quote.opportunity.contact) : null,
    quoteDate: quote.quoteDate,
    expirationDate: quote.expirationDate,
    config: (quote.config ?? null) as QuoteConfig | null,
    catalog,
    discountEur: quote.discountEur,
    stored: {
      minPriceMdl: quote.minPriceMdl,
      offerPriceMdl: quote.offerPriceMdl,
      totalPrice: quote.totalPrice,
      cursEuro: quote.offerPriceEur > 0 ? quote.offerPriceMdl / quote.offerPriceEur : catalog.cursEuro,
    },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="estimare-${quote.id}.pdf"`,
    },
  });
}
