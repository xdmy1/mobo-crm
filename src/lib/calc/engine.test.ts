import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG } from "./catalog";
import { computeQuote, EMPTY_CONFIG, type QuoteConfig } from "./engine";

// Cazul din §11 al promptului: 3000×2400, MDF 1P, PAL Egger Color,
// 1 sertar Blum metal, 1 Aventos HS, blat PAL Egger 3 m².
const baseConfig: QuoteConfig = {
  ...EMPTY_CONFIG,
  qualityLevel: "STANDARD",
  furnitureType: "BUCATARIE",
  lengthMm: 3000,
  heightMm: 2400,
  depth: 600,
  bodyBrand: "PAL_EGGER",
  bodyFinish: "COLOR",
  facade: "MDF_1P",
  drawers: [{ brand: "blum", material: "metal", qty: 1 }],
  mechanisms: [{ brand: "blum", key: "aventos_hs", qty: 1 }],
  worktop: { material: "PAL_EGGER", sqm: 3 },
};

describe("computeQuote", () => {
  it("calculează cazul de referință din catalog", () => {
    const r = computeQuote(baseConfig, DEFAULT_CATALOG);
    // suprafață = 3000×2400/1e6 = 7.2 m²
    expect(r.facadeArea).toBe(7.2);
    // fațadă: 7.2 × 1800 = 12960
    // corp:   7.2 × 260  = 1872
    // sertar Blum metal: 1100
    // Aventos HS: 0 (— în catalog)
    // blat: 3 × 850 = 2550
    const expectedCost = 7.2 * 1800 + 7.2 * 260 + 1100 + 0 + 3 * 850;
    expect(r.minPriceMdl).toBeCloseTo(expectedCost, 2);
    // ofertare = cost × 2.3 (Bucătărie, STANDARD)
    expect(r.offerPriceMdl).toBeCloseTo(expectedCost * 2.3, 2);
    // conversie euro
    expect(r.offerPriceEur).toBeCloseTo((expectedCost * 2.3) / 20.1147, 2);
    // reducerea maximă = ofertare − minim
    expect(r.maxDiscountMdl).toBeCloseTo(expectedCost * 1.3, 2);
  });

  it("aplică coeficientul PREMIUM", () => {
    const std = computeQuote(baseConfig, DEFAULT_CATALOG);
    const prem = computeQuote(
      { ...baseConfig, qualityLevel: "PREMIUM" },
      DEFAULT_CATALOG
    );
    expect(prem.offerPriceMdl).toBeCloseTo(
      std.offerPriceMdl * DEFAULT_CATALOG.premiumCoefficient,
      1
    );
  });

  it("aplică coeficientul de adâncime 900 doar pe corp", () => {
    const d600 = computeQuote(baseConfig, DEFAULT_CATALOG);
    const d900 = computeQuote({ ...baseConfig, depth: 900 }, DEFAULT_CATALOG);
    const bodyDelta =
      7.2 * 260 * (DEFAULT_CATALOG.depth900Coefficient - 1);
    expect(d900.minPriceMdl - d600.minPriceMdl).toBeCloseTo(bodyDelta, 2);
  });

  it("limitează reducerea manuală la maximul permis", () => {
    const r = computeQuote(
      { ...baseConfig, manualDiscountMdl: 99_999_999 },
      DEFAULT_CATALOG
    );
    expect(r.appliedDiscountMdl).toBe(r.maxDiscountMdl);
    expect(r.totalMdl).toBeCloseTo(r.minPriceMdl, 2);
  });

  it("nu permite reducere negativă", () => {
    const r = computeQuote(
      { ...baseConfig, manualDiscountMdl: -500 },
      DEFAULT_CATALOG
    );
    expect(r.appliedDiscountMdl).toBe(0);
  });

  it("calculează sticla și oglinda pe suprafață", () => {
    const r = computeQuote(
      {
        ...baseConfig,
        glass: { kind: "DIAMOND", lMm: 1000, hMm: 500 },
        mirror: { kind: "SIMPLA", lMm: 400, hMm: 400 },
      },
      DEFAULT_CATALOG
    );
    const base = computeQuote(baseConfig, DEFAULT_CATALOG);
    const glassCost = 0.5 * DEFAULT_CATALOG.glassPrices.DIAMOND;
    const mirrorCost = 0.16 * DEFAULT_CATALOG.mirrorPrices.SIMPLA;
    expect(r.minPriceMdl - base.minPriceMdl).toBeCloseTo(
      glassCost + mirrorCost,
      2
    );
  });

  it("adaugă organizatoarele [NOU]", () => {
    const r = computeQuote(
      { ...baseConfig, organizers: [{ key: "pantaloni_800", qty: 2 }] },
      DEFAULT_CATALOG
    );
    const base = computeQuote(baseConfig, DEFAULT_CATALOG);
    expect(r.minPriceMdl - base.minPriceMdl).toBeCloseTo(2 * 2650, 2);
  });

  it("configurație goală → toate prețurile 0 (Estimare la preț 0.00)", () => {
    const r = computeQuote(EMPTY_CONFIG, DEFAULT_CATALOG);
    expect(r.minPriceMdl).toBe(0);
    expect(r.offerPriceMdl).toBe(0);
    expect(r.totalMdl).toBe(0);
  });
});
