import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { computeQuote, EMPTY_CONFIG, type QuoteConfig } from "@/lib/calc/engine";
import { quoteTitle } from "@/lib/format";
import {
  bad,
  checkApiKey,
  createLeadPipeline,
  rateLimit,
} from "../_lib";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/public/calculator — calculatorul public de preț de pe site.
 * Header: X-Api-Key.
 * Body: { firstName, lastName, phone, email?, config?: QuoteConfig-parțial, site?: SiteCalculation }.
 *
 * `site` = calculul făcut de calculatorul de pe mobo.md (are propriul model de preț). Se salvează
 * EXACT ce a văzut vizitatorul — total, alegeri, defalcare — ca prețul din CRM să fie același cu cel
 * de pe ecranul lui. Fără `site`, estimarea se calculează cu motorul CRM-ului din `config`.
 */
interface SiteCalculation {
  rows?: Array<{ label: string; value: string }>;
  breakdown?: Array<{ label: string; detail?: string; amount: number }>;
  total: number;
  totalEur: number;
  lang?: string;
}
export async function POST(req: NextRequest) {
  if (!rateLimit(req)) return bad("Prea multe cereri. Încearcă mai târziu.", 429);
  if (!checkApiKey(req)) return bad("API key invalid", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("Body JSON invalid");
  if (!body.phone && !body.email)
    return bad("Telefonul sau emailul este obligatoriu");

  const site: SiteCalculation | null =
    body.site && Number.isFinite(Number(body.site.total)) ? (body.site as SiteCalculation) : null;

  const { contact, opportunity, duplicated } = await createLeadPipeline(
    { ...body, lang: body.lang ?? site?.lang, source: body.source ?? "mobo.md/calculator" },
    "Estimare din Calculator"
  );

  if (site) {
    const total = Math.max(0, Number(site.total));
    const totalEur = Math.max(0, Number(site.totalEur) || 0);
    const quote = await prisma.quote.create({
      data: {
        name: quoteTitle(total),
        opportunityId: opportunity.id,
        quoteDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 86400000),
        totalPrice: total,
        minPriceEur: totalEur,
        minPriceMdl: total,
        offerPriceEur: totalEur,
        offerPriceMdl: total,
        // forma QuoteConfig rămâne validă (paginile CRM o pot citi), iar specificația site-ului stă alături
        config: {
          ...EMPTY_CONFIG,
          _site: {
            rows: (site.rows ?? []).slice(0, 40),
            breakdown: (site.breakdown ?? []).slice(0, 20),
            lang: site.lang ?? null,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      humanId: contact.humanId,
      quoteId: quote.id,
      duplicated,
      price: { totalMdl: total, totalEur },
    });
  }

  const config: QuoteConfig = { ...EMPTY_CONFIG, ...(body.config ?? {}) };
  const catalog = await getActiveCatalog();
  const r = computeQuote(config, catalog);

  const quote = await prisma.quote.create({
    data: {
      // același nume ca la estimările create din wizard
      name: quoteTitle(r.totalMdl),
      opportunityId: opportunity.id,
      quoteDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 86400000),
      totalPrice: r.totalMdl,
      minPriceEur: r.minPriceEur,
      minPriceMdl: r.minPriceMdl,
      offerPriceEur: r.offerPriceEur,
      offerPriceMdl: r.offerPriceMdl,
      config: config as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    ok: true,
    contactId: contact.id,
    humanId: contact.humanId,
    quoteId: quote.id,
    duplicated,
    price: {
      totalMdl: r.totalMdl,
      totalEur: r.totalEur,
      offerPriceMdl: r.offerPriceMdl,
    },
  });
}
