import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quoteTitle } from "@/lib/format";
import {
  bad,
  checkApiKey,
  createLeadPipeline,
  rateLimit,
} from "../_lib";

export const runtime = "nodejs";

/**
 * POST /api/public/lead — formularul „Cerere de pe site” (mobo.md).
 * Header: X-Api-Key.
 * Body: { firstName, lastName, phone, email?, room?, budget?, message?, source?, lang? }.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(req)) return bad("Prea multe cereri. Încearcă mai târziu.", 429);
  if (!checkApiKey(req)) return bad("API key invalid", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("Body JSON invalid");
  if (!body.phone && !body.email)
    return bad("Telefonul sau emailul este obligatoriu");

  const { contact, opportunity, duplicated } = await createLeadPipeline(
    body,
    "Cerere de pe site"
  );

  // estimare goală „Estimare la preț 0.00”
  await prisma.quote.create({
    data: {
      name: quoteTitle(0),
      opportunityId: opportunity.id,
      quoteDate: new Date(),
      expirationDate: new Date(Date.now() + 30 * 86400000),
    },
  });

  return NextResponse.json({
    ok: true,
    contactId: contact.id,
    humanId: contact.humanId,
    duplicated,
  });
}
