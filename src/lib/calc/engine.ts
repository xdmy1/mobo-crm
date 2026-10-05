// Motorul de calcul al estimării tehnice (§8 din spec).
// Pur, testabil, fără dependențe de DB — catalogul vine ca parametru.

import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  GLASS_LABELS,
  MECHANISM_LABELS,
  ORGANIZER_LABELS,
  WORKTOP_LABELS,
} from "./catalog";
import type {
  BodyBrand,
  BodyFinish,
  CalcCatalogData,
  DrawerBrand,
  DrawerMaterial,
  FacadeMaterial,
  FurnitureType,
  GlassKind,
  QualityLevel,
  WorktopMaterial,
} from "./catalog";

export interface GlassSelection {
  kind: GlassKind;
  lMm: number;
  hMm: number;
}

export interface DrawerLine {
  brand: DrawerBrand;
  material: DrawerMaterial;
  qty: number;
}

export interface MechanismLine {
  brand: "blum" | "hettich" | "kessebohmer";
  key: string;
  qty: number;
}

export interface OrganizerLine {
  key: string;
  qty: number;
}

export interface QuoteConfig {
  qualityLevel: QualityLevel | null;
  furnitureType: FurnitureType | null;
  lengthMm: number | null;
  heightMm: number | null;
  depth: 600 | 900 | null;
  bodyBrand: BodyBrand | null;
  bodyFinish: BodyFinish | null;
  facade: FacadeMaterial | null;
  glass: GlassSelection | null;
  mirror: GlassSelection | null;
  drawers: DrawerLine[];
  mechanisms: MechanismLine[];
  organizers: OrganizerLine[];
  worktop: { material: WorktopMaterial; sqm: number } | null;
  manualDiscountMdl: number;
}

export const EMPTY_CONFIG: QuoteConfig = {
  qualityLevel: null,
  furnitureType: null,
  lengthMm: null,
  heightMm: null,
  depth: null,
  bodyBrand: null,
  bodyFinish: null,
  facade: null,
  glass: null,
  mirror: null,
  drawers: [],
  mechanisms: [],
  organizers: [],
  worktop: null,
  manualDiscountMdl: 0,
};

export interface BreakdownLine {
  label: string;
  /** calculul, pentru uz intern (m² × preț…) */
  detail: string;
  /** ce este / din ce e făcut — fără prețuri și metraj; asta vede clientul în PDF */
  spec: string;
  amountMdl: number;
}

export interface QuoteComputation {
  /** m² fațadă */
  facadeArea: number;
  breakdown: BreakdownLine[];
  /** Cost de producție = Preț minim (MDL) */
  minPriceMdl: number;
  minPriceEur: number;
  /** Preț de ofertare (MDL/€), înainte de reducere */
  offerPriceMdl: number;
  offerPriceEur: number;
  /** Reducerea maximă permisă = ofertare − minim */
  maxDiscountMdl: number;
  maxDiscountEur: number;
  /** Reducerea manuală efectiv aplicată (limitată la maxim) */
  appliedDiscountMdl: number;
  /** Total final (MDL), după reducere */
  totalMdl: number;
  totalEur: number;
  /** Marja (ofertare − cost − reducere) [NOU] */
  marginMdl: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeQuote(
  config: QuoteConfig,
  catalog: CalcCatalogData
): QuoteComputation {
  const breakdown: BreakdownLine[] = [];
  const area =
    config.lengthMm && config.heightMm
      ? (config.lengthMm * config.heightMm) / 1_000_000
      : 0;

  let cost = 0;

  // Fațadă
  if (config.facade && area > 0) {
    const price = catalog.facadePrices[config.facade] ?? 0;
    const amount = area * price;
    breakdown.push({
      label: "Fațadă",
      detail: `${r2(area)} m² × ${price} MDL/m²`,
      spec: FACADE_LABELS[config.facade],
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Corp
  if (config.bodyBrand && config.bodyFinish && area > 0) {
    const base = catalog.bodyPrices[config.bodyBrand]?.[config.bodyFinish] ?? 0;
    const depthCoef = config.depth === 900 ? catalog.depth900Coefficient : 1;
    const amount = area * base * depthCoef;
    breakdown.push({
      label: "Corp",
      detail: `${r2(area)} m² × ${base} MDL/m²${
        depthCoef !== 1 ? ` × ${depthCoef} (A:900)` : ""
      }`,
      spec: `${BODY_BRAND_LABELS[config.bodyBrand]} – ${BODY_FINISH_LABELS[config.bodyFinish]}`,
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Sertare
  for (const d of config.drawers) {
    if (d.qty <= 0) continue;
    const price = catalog.drawerPrices[d.brand]?.[d.material] ?? 0;
    const amount = d.qty * price;
    breakdown.push({
      label: `Sertar ${d.brand === "blum" ? "Blum" : "Hettich"} ${
        d.material === "metal" ? "metal" : "lemn"
      }`,
      detail: `${d.qty} buc × ${price} MDL`,
      spec: `${d.qty} buc`,
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Mecanisme
  for (const m of config.mechanisms) {
    if (m.qty <= 0) continue;
    const price = catalog.mechanisms[m.brand]?.[m.key] ?? 0;
    const amount = m.qty * price;
    const name = MECHANISM_LABELS[m.key] ?? m.key.replace(/_/g, " ");
    breakdown.push({
      // „Mecanism de colț 600” are deja cuvântul în nume
      label: /^mecanism/i.test(name) ? name : `Mecanism ${name}`,
      detail: `${m.qty} buc × ${price} MDL`,
      spec: `${m.qty} buc`,
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Sticlă / Oglindă
  if (config.glass && config.glass.lMm > 0 && config.glass.hMm > 0) {
    const a = (config.glass.lMm * config.glass.hMm) / 1_000_000;
    const price = catalog.glassPrices[config.glass.kind] ?? 0;
    const amount = a * price;
    breakdown.push({
      label: "Sticlă",
      detail: `${GLASS_LABELS[config.glass.kind]} · ${r2(a)} m² × ${price} MDL/m²`,
      spec: GLASS_LABELS[config.glass.kind],
      amountMdl: r2(amount),
    });
    cost += amount;
  }
  if (config.mirror && config.mirror.lMm > 0 && config.mirror.hMm > 0) {
    const a = (config.mirror.lMm * config.mirror.hMm) / 1_000_000;
    const price = catalog.mirrorPrices[config.mirror.kind] ?? 0;
    const amount = a * price;
    breakdown.push({
      label: "Oglindă",
      detail: `${GLASS_LABELS[config.mirror.kind]} · ${r2(a)} m² × ${price} MDL/m²`,
      spec: GLASS_LABELS[config.mirror.kind],
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Organizatoare [NOU]
  for (const o of config.organizers) {
    if (o.qty <= 0) continue;
    const price = catalog.organizerPrices[o.key] ?? 0;
    const amount = o.qty * price;
    breakdown.push({
      label: `Organizator ${(ORGANIZER_LABELS[o.key] ?? o.key.replace(/_/g, " ")).toLowerCase()}`,
      detail: `${o.qty} buc × ${price} MDL`,
      spec: `${o.qty} buc`,
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  // Blat
  if (config.worktop && config.worktop.sqm > 0) {
    const price = catalog.worktopPrices[config.worktop.material] ?? 0;
    const amount = config.worktop.sqm * price;
    breakdown.push({
      label: "Blat",
      detail: `${config.worktop.sqm} m² × ${price} MDL/m²`,
      spec: WORKTOP_LABELS[config.worktop.material],
      amountMdl: r2(amount),
    });
    cost += amount;
  }

  const minPriceMdl = r2(cost);

  const coef = config.furnitureType
    ? catalog.coefficients[config.furnitureType] ?? 1
    : 1;
  const premium =
    config.qualityLevel === "PREMIUM" ? catalog.premiumCoefficient : 1;
  const offerPriceMdl = r2(cost * coef * premium);

  const maxDiscountMdl = Math.max(0, r2(offerPriceMdl - minPriceMdl));
  const appliedDiscountMdl = Math.min(
    Math.max(0, config.manualDiscountMdl || 0),
    maxDiscountMdl
  );
  const totalMdl = r2(offerPriceMdl - appliedDiscountMdl);

  const toEur = (mdl: number) =>
    catalog.cursEuro > 0 ? r2(mdl / catalog.cursEuro) : 0;

  return {
    facadeArea: r2(area),
    breakdown,
    minPriceMdl,
    minPriceEur: toEur(minPriceMdl),
    offerPriceMdl,
    offerPriceEur: toEur(offerPriceMdl),
    maxDiscountMdl,
    maxDiscountEur: toEur(maxDiscountMdl),
    appliedDiscountMdl: r2(appliedDiscountMdl),
    totalMdl,
    totalEur: toEur(totalMdl),
    marginMdl: r2(totalMdl - minPriceMdl),
  };
}

/** Validarea per pas a wizard-ului. Returnează mesajul de eroare sau null. */
export function validateStep(step: number, c: QuoteConfig): string | null {
  switch (step) {
    case 1:
      return c.qualityLevel ? null : "Selectați nivelul de calitate pentru a continua";
    case 2:
      return c.furnitureType ? null : "Selectați tipul de mobilier pentru a continua";
    case 3:
      if (!c.lengthMm || c.lengthMm <= 0)
        return "Introduceți lungimea pentru a continua";
      if (!c.heightMm || c.heightMm <= 0)
        return "Introduceți înălțimea pentru a continua";
      // limite de bun-simț: dimensiunile sunt în MILIMETRI (o bucătărie de 12 cm sau de 120 m e o greșeală de tastare)
      if (c.lengthMm < 300 || c.lengthMm > 20000)
        return "Lungimea se introduce în milimetri: între 300 și 20.000 (ex. 3600 pentru 3,6 m)";
      if (c.heightMm < 300 || c.heightMm > 4000)
        return "Înălțimea se introduce în milimetri: între 300 și 4.000 (ex. 2400 pentru 2,4 m)";
      if (!c.depth) return "Selectați adâncimea pentru a continua";
      return null;
    case 4:
      if (!c.bodyBrand) return "Selectați brandul PAL pentru a continua";
      if (!c.bodyFinish) return "Selectați finisajul pentru a continua";
      return null;
    case 5:
      return c.facade ? null : "Selectați materialul fațadei pentru a continua";
    case 6: {
      if (c.glass && (!c.glass.lMm || !c.glass.hMm))
        return "Introduceți dimensiunile sticlei pentru a continua";
      if (c.mirror && (!c.mirror.lMm || !c.mirror.hMm))
        return "Introduceți dimensiunile oglinzii pentru a continua";
      // sticla / oglinda nu pot depăși corpul de mobilier
      const maxL = c.lengthMm ?? 20000;
      const maxH = c.heightMm ?? 4000;
      if (c.glass && (c.glass.lMm > maxL || c.glass.hMm > maxH))
        return `Sticla nu poate depăși dimensiunile corpului (${maxL} × ${maxH} mm)`;
      if (c.mirror && (c.mirror.lMm > maxL || c.mirror.hMm > maxH))
        return `Oglinda nu poate depăși dimensiunile corpului (${maxL} × ${maxH} mm)`;
      return null;
    }
    case 12:
      if (c.worktop && (c.worktop.sqm <= 0 || c.worktop.sqm > 60))
        return "Suprafața blatului se introduce în m², între 0,1 și 60";
      return null;
    default:
      return null; // pașii 7–11 sunt opționali
  }
}
