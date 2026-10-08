// Prezentarea demo pentru clientul de probă „Damian B.”
//   npx tsx scripts/demo-presentation.ts "<folder de ieșire>"
// Creează clientul o singură dată (cu estimări calculate de motorul real), apoi generează
// PPTX + PDF în RO și RU din datele lui — exact ce face butonul „Creare Prezentare” din fișa clientului.

import fs from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { computeQuote, EMPTY_CONFIG, type QuoteConfig } from "@/lib/calc/engine";
import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  FURNITURE_LABELS,
  WORKTOP_LABELS,
} from "@/lib/calc/catalog";
import { fmtDate, quoteTitle } from "@/lib/format";
import { personName } from "@/lib/people";
import { opportunitySum, round2 } from "@/lib/sums";
import { generatePresentationPptx } from "@/lib/presentations/generatePptx";
import { generatePresentationPdf } from "@/lib/presentations/generatePdf";
import { PUB, type PresentationData, type PresentationProject } from "@/lib/presentations/data";

const outDir = process.argv[2] ?? ".";

const PLAN: Array<{ roomType: string; project: string; type: string; photo: string; cfg: Partial<QuoteConfig> }> = [
  {
    roomType: "Cameră Bucătărie",
    project: "Bucătărie Premium cu insulă",
    type: "Bucătărie la comandă",
    photo: "wizard/premium.jpg",
    cfg: { qualityLevel: "PREMIUM", furnitureType: "BUCATARIE", lengthMm: 5200, heightMm: 2400, depth: 600, bodyBrand: "PAL_EGGER", bodyFinish: "LEMN", facade: "MDF_2P", worktop: { material: "HPL_NEGRU", sqm: 3.4 } },
  },
  {
    roomType: "Cameră Dormitor Matrimonial",
    project: "Dressing dormitor matrimonial",
    type: "Garderobă",
    photo: "wizard/garderoba.jpg",
    cfg: { qualityLevel: "PREMIUM", furnitureType: "GARDEROBA", lengthMm: 3400, heightMm: 2600, depth: 600, bodyBrand: "PAL_EGGER", bodyFinish: "LEMN", facade: "FURNIR" },
  },
  {
    roomType: "Cameră Living",
    project: "Mobilier living cu nișă TV",
    type: "Mobilier living",
    photo: "wizard/standard.jpg",
    cfg: { qualityLevel: "STANDARD", furnitureType: "DULAP", lengthMm: 3800, heightMm: 2400, depth: 600, bodyBrand: "PAL_KRONO", bodyFinish: "COLOR", facade: "AGT_2P" },
  },
];

function specs(cfg: QuoteConfig, ru: boolean): string[] {
  const L = ru
    ? { tip: "Тип", mode: "Уровень", dim: "Размеры", corp: "Корпус", fat: "Фасад", blat: "Столешница" }
    : { tip: "Tip", mode: "Nivel", dim: "Dimensiuni", corp: "Corp", fat: "Fațadă", blat: "Blat" };
  const out: string[] = [];
  if (cfg.furnitureType) out.push(`${L.tip}: ${FURNITURE_LABELS[cfg.furnitureType]}`);
  if (cfg.qualityLevel) out.push(`${L.mode}: ${cfg.qualityLevel}`);
  if (cfg.lengthMm && cfg.heightMm)
    out.push(`${L.dim}: ${(cfg.lengthMm / 1000).toFixed(1)} m × ${(cfg.heightMm / 1000).toFixed(1)} m (A: ${cfg.depth ?? "-"} mm)`);
  if (cfg.bodyBrand)
    out.push(`${L.corp}: ${BODY_BRAND_LABELS[cfg.bodyBrand]}${cfg.bodyFinish ? ` — ${BODY_FINISH_LABELS[cfg.bodyFinish]}` : ""}`);
  if (cfg.facade) out.push(`${L.fat}: ${FACADE_LABELS[cfg.facade]}`);
  if (cfg.worktop) out.push(`${L.blat}: ${WORKTOP_LABELS[cfg.worktop.material]} — ${cfg.worktop.sqm} m²`);
  return out;
}

async function ensureDemoClient() {
  const existing = await prisma.contact.findFirst({
    where: { firstName: "Damian", lastName: "B.", deletedAt: null },
  });
  if (existing) return existing;

  const [stage, source, staff, catalog] = await Promise.all([
    prisma.contactStage.findFirst({ where: { name: "Prezentare" } }),
    prisma.contactSource.findFirst({ where: { name: "Recomandare client" } }),
    prisma.staff.findFirst({ where: { firstName: "Manager", lastName: "Vânzări" } }),
    getActiveCatalog(),
  ]);
  const contact = await prisma.contact.create({
    data: {
      firstName: "Damian",
      lastName: "B.",
      phone: "+37369123456",
      email: "damian.b@example.md",
      deliveryAddress: "Chișinău, str. Exemplu 12",
      stageId: stage?.id,
      sourceId: source?.id,
      staffId: staff?.id,
      stageHistory: stage ? { create: { stageId: stage.id } } : undefined,
    },
  });
  for (const item of PLAN) {
    const [roomType, oppType] = await Promise.all([
      prisma.roomType.findFirst({ where: { name: item.roomType } }),
      prisma.opportunityType.findFirst({ where: { name: item.type } }),
    ]);
    const room = await prisma.room.create({
      data: { contactId: contact.id, roomTypeId: roomType?.id, name: item.roomType },
    });
    const opp = await prisma.opportunity.create({
      data: {
        name: item.project,
        roomId: room.id,
        contactId: contact.id,
        staffId: contact.staffId,
        typeId: oppType?.id,
        startDate: new Date(),
        closeDate: new Date(Date.now() + 45 * 86400000),
      },
    });
    const config: QuoteConfig = { ...EMPTY_CONFIG, ...item.cfg };
    const r = computeQuote(config, catalog);
    await prisma.quote.create({
      data: {
        name: quoteTitle(r.totalMdl),
        opportunityId: opp.id,
        staffId: contact.staffId,
        quoteDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 86400000),
        totalPrice: r.totalMdl,
        minPriceEur: r.minPriceEur,
        minPriceMdl: r.minPriceMdl,
        offerPriceEur: r.offerPriceEur,
        offerPriceMdl: r.offerPriceMdl,
        discountEur: 0,
        config: config as unknown as Prisma.InputJsonValue,
        active: true,
      },
    });
  }
  return contact;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const contact = await ensureDemoClient();
  const [full, org, catalog] = await Promise.all([
    prisma.contact.findUniqueOrThrow({
      where: { id: contact.id },
      include: {
        staff: true,
        opportunities: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
          include: {
            room: true,
            quotes: { where: { deletedAt: null, active: true }, orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    prisma.organization.findUnique({ where: { id: 1 } }),
    getActiveCatalog(),
  ]);

  const today = new Date();
  for (const lang of ["RO", "RU"] as const) {
    const projects: PresentationProject[] = [];
    let totalEur = 0;
    let totalMdl = 0;
    for (const [i, o] of full.opportunities.entries()) {
      const sum = await opportunitySum(o.id);
      const cfg = (o.quotes[0]?.config ?? null) as QuoteConfig | null;
      projects.push({
        name: o.name,
        room: (o.room?.name ?? "—").replace(/^Cameră\s+/i, ""),
        specs: cfg ? specs(cfg, lang === "RU") : [],
        priceEur: sum.eur,
        priceMdl: sum.lei,
        photo: PUB(PLAN[i]?.photo ?? "wizard/premium.jpg"),
      });
      totalEur += sum.eur;
      totalMdl += sum.lei;
    }
    const data: PresentationData = {
      lang,
      org: { name: org?.name ?? "Mobo kitchens & home", phone: org?.phone, email: org?.email, address: org?.address },
      clientName: personName(full),
      humanId: full.humanId,
      dateText: fmtDate(today),
      validUntilText: fmtDate(new Date(today.getTime() + 30 * 86400000)),
      consultant: full.staff ? { name: personName(full.staff), email: full.staff.email } : null,
      projects,
      totalEur: round2(totalEur),
      totalMdl: round2(totalMdl),
      includePhotos: true,
      includeStages: true,
      cursEuro: catalog.cursEuro,
    };
    fs.writeFileSync(path.join(outDir, `prezentare-${lang}.pptx`), await generatePresentationPptx(data));
    fs.writeFileSync(path.join(outDir, `prezentare-${lang}.pdf`), await generatePresentationPdf(data));
  }
  console.log(`Client demo #${full.id} (${full.humanId}) → ${outDir}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
