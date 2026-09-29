"use server";

// Generarea prezentărilor de ofertă (PPTX + PDF) din datele clientului [NOU].

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { advanceContactTo } from "@/server/workflow";
import { saveDocFile } from "@/lib/pdf/core";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { opportunitySum } from "@/lib/sums";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/people";
import { generatePresentationPptx } from "@/lib/presentations/generatePptx";
import { generatePresentationPdf } from "@/lib/presentations/generatePdf";
import { PUB, type PresentationData, type PresentationProject } from "@/lib/presentations/data";
import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  FURNITURE_LABELS,
  WORKTOP_LABELS,
} from "@/lib/calc/catalog";
import type { QuoteConfig } from "@/lib/calc/engine";
import type { Lang } from "@/lib/pdf/texts";
import type { ActionResult } from "@/lib/listTypes";

const sanitize = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_");

const PHOTO_BY_TYPE: Record<string, string> = {
  BUCATARIE: "wizard/bucatarie.jpg",
  GARDEROBA: "wizard/garderoba.jpg",
  DULAP: "wizard/dulap.jpg",
  PIESE_MICI: "wizard/piese_mici.jpg",
};

/** Fotografia slide-ului de proiect: după tipul din estimare, altfel după numele camerei / proiectului. */
function projectPhoto(cfg: QuoteConfig | null, ...names: Array<string | null | undefined>): string | undefined {
  if (cfg?.furnitureType) return PUB(PHOTO_BY_TYPE[cfg.furnitureType]);
  const text = names.filter(Boolean).join(" ").toLowerCase();
  if (/buc[aă]t|кухн/.test(text)) return PUB("wizard/premium.jpg");
  if (/garderob|dressing|гардероб/.test(text)) return PUB("wizard/garderoba.jpg");
  if (/dormitor|спальн/.test(text)) return PUB("wizard/dulap.jpg");
  if (/living|sufragerie|гостин/.test(text)) return PUB("wizard/standard.jpg");
  return undefined;
}

function specsFromConfig(cfg: QuoteConfig | null, lang: Lang): string[] {
  if (!cfg) return [];
  const L = lang === "RU"
    ? { tip: "Тип", dim: "Размеры", corp: "Корпус", fat: "Фасад", blat: "Столешница", mode: "Уровень" }
    : { tip: "Tip", dim: "Dimensiuni", corp: "Corp", fat: "Fațadă", blat: "Blat", mode: "Nivel" };
  const out: string[] = [];
  if (cfg.furnitureType) out.push(`${L.tip}: ${FURNITURE_LABELS[cfg.furnitureType]}`);
  if (cfg.qualityLevel) out.push(`${L.mode}: ${cfg.qualityLevel}`);
  if (cfg.lengthMm && cfg.heightMm)
    out.push(
      `${L.dim}: ${(cfg.lengthMm / 1000).toFixed(1)} m × ${(cfg.heightMm / 1000).toFixed(1)} m (A: ${cfg.depth ?? "-"} mm)`
    );
  if (cfg.bodyBrand)
    out.push(
      `${L.corp}: ${BODY_BRAND_LABELS[cfg.bodyBrand]}${cfg.bodyFinish ? ` — ${BODY_FINISH_LABELS[cfg.bodyFinish]}` : ""}`
    );
  if (cfg.facade) out.push(`${L.fat}: ${FACADE_LABELS[cfg.facade]}`);
  if (cfg.worktop)
    out.push(`${L.blat}: ${WORKTOP_LABELS[cfg.worktop.material]} — ${cfg.worktop.sqm} m²`);
  return out.slice(0, 6);
}

export async function createPresentation(values: {
  contactId?: string | null;
  language?: string;
  formats?: string[]; // ["pptx","pdf"]
  includePhotos?: boolean;
  includeStages?: boolean;
}): Promise<ActionResult & { downloadUrls?: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-offer"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const contactId = values.contactId ? parseInt(values.contactId, 10) : null;
  if (!contactId) return { ok: false, error: "Selectați clientul." };
  const lang = (values.language === "RU" ? "RU" : "RO") as Lang;
  const formats = values.formats?.length ? values.formats : ["pptx", "pdf"];

  const [org, contact, catalog] = await Promise.all([
    prisma.organization.findUnique({ where: { id: 1 } }),
    prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        staff: true,
        opportunities: {
          where: { deletedAt: null },
          include: {
            room: true,
            // specificațiile vin din estimarea care contează la preț (cea activă), nu dintr-o variantă
            quotes: {
              where: { deletedAt: null, active: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    }),
    getActiveCatalog(),
  ]);
  if (!contact) return { ok: false, error: "Client inexistent." };

  const projects: PresentationProject[] = [];
  let totalEur = 0;
  let totalMdl = 0;
  for (const opp of contact.opportunities) {
    const sum = await opportunitySum(opp.id);
    if (sum.lei <= 0 && contact.opportunities.length > 1) continue;
    const cfg = (opp.quotes[0]?.config ?? null) as QuoteConfig | null;
    projects.push({
      name: opp.name,
      room: opp.room?.name ?? "—",
      specs: specsFromConfig(cfg, lang),
      priceEur: sum.eur,
      priceMdl: sum.lei,
      photo: projectPhoto(cfg, opp.room?.name, opp.name),
    });
    totalEur += sum.eur;
    totalMdl += sum.lei;
  }
  if (projects.length === 0)
    return {
      ok: false,
      error: "Clientul nu are niciun proiect cu estimare — creează întâi o estimare tehnică.",
    };

  const clientName = personName(contact);
  const today = new Date();
  const data: PresentationData = {
    lang,
    org: {
      name: org?.name ?? "Mobo kitchens & home",
      phone: org?.phone,
      email: org?.email,
      address: org?.address,
    },
    clientName,
    humanId: contact.humanId,
    dateText: fmtDate(today),
    validUntilText: fmtDate(new Date(today.getTime() + 30 * 86400000)),
    consultant: contact.staff
      ? { name: personName(contact.staff), email: contact.staff.email }
      : null,
    projects,
    totalEur,
    totalMdl,
    includePhotos: values.includePhotos !== false,
    includeStages: values.includeStages !== false,
    cursEuro: catalog.cursEuro,
  };

  const downloadUrls: string[] = [];
  try {
    if (formats.includes("pptx")) {
      const buf = await generatePresentationPptx(data);
      const fileName = `${sanitize(clientName)}_prezentare.pptx`;
      const filePath = await saveDocFile(buf, fileName);
      await prisma.offer.create({
        data: { fileName, contactId, language: lang, filePath, showStagePrices: data.includeStages },
      });
      downloadUrls.push(`/api/files/${encodeURIComponent(filePath)}?download=1`);
    }
    if (formats.includes("pdf")) {
      const buf = await generatePresentationPdf(data);
      const fileName = `${sanitize(clientName)}_prezentare.pdf`;
      const filePath = await saveDocFile(buf, fileName);
      await prisma.offer.create({
        data: { fileName, contactId, language: lang, filePath, showStagePrices: data.includeStages },
      });
      downloadUrls.push(`/api/files/${encodeURIComponent(filePath)}?download=1`);
    }
  } catch (e) {
    return {
      ok: false,
      error: `Generarea a eșuat: ${e instanceof Error ? e.message : "eroare necunoscută"}`,
    };
  }

  await audit(user.id, "create", "presentation", contactId, { formats, lang });
  await advanceContactTo(contactId, "Prezentare", user.id, "prezentare creată");
  revalidatePath("/admin", "layout");
  return { ok: true, downloadUrls, downloadUrl: downloadUrls[0] };
}
