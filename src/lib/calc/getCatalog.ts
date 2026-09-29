import { prisma } from "@/lib/db";
import { DEFAULT_CATALOG, type CalcCatalogData } from "./catalog";

/** Catalogul activ din DB (Setări de Calcule). Cade pe DEFAULT_CATALOG dacă lipsește. */
export async function getActiveCatalog(): Promise<CalcCatalogData> {
  const row = await prisma.calcCatalog.findFirst({
    where: { active: true },
    orderBy: { validFrom: "desc" },
  });
  if (!row) return DEFAULT_CATALOG;
  const data = row.data as unknown as Partial<CalcCatalogData>;
  // merge defensiv peste default, ca să nu crape la câmpuri lipsă
  return {
    ...DEFAULT_CATALOG,
    ...data,
    coefficients: { ...DEFAULT_CATALOG.coefficients, ...data.coefficients },
    facadePrices: { ...DEFAULT_CATALOG.facadePrices, ...data.facadePrices },
    bodyPrices: {
      PAL_EGGER: { ...DEFAULT_CATALOG.bodyPrices.PAL_EGGER, ...data.bodyPrices?.PAL_EGGER },
      PAL_KRONO: { ...DEFAULT_CATALOG.bodyPrices.PAL_KRONO, ...data.bodyPrices?.PAL_KRONO },
    },
    drawerPrices: {
      blum: { ...DEFAULT_CATALOG.drawerPrices.blum, ...data.drawerPrices?.blum },
      hettich: { ...DEFAULT_CATALOG.drawerPrices.hettich, ...data.drawerPrices?.hettich },
    },
    mechanisms: {
      blum: { ...DEFAULT_CATALOG.mechanisms.blum, ...data.mechanisms?.blum },
      hettich: { ...DEFAULT_CATALOG.mechanisms.hettich, ...data.mechanisms?.hettich },
      kessebohmer: { ...DEFAULT_CATALOG.mechanisms.kessebohmer, ...data.mechanisms?.kessebohmer },
    },
    glassPrices: { ...DEFAULT_CATALOG.glassPrices, ...data.glassPrices },
    mirrorPrices: { ...DEFAULT_CATALOG.mirrorPrices, ...data.mirrorPrices },
    worktopPrices: { ...DEFAULT_CATALOG.worktopPrices, ...data.worktopPrices },
    organizerPrices: { ...DEFAULT_CATALOG.organizerPrices, ...data.organizerPrices },
  };
}
