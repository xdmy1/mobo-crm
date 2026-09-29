// Catalogul de prețuri și coeficienți — „Setări de Calcule”
// Toate valorile sunt configurabile din /admin/setup/settings și stocate în DB (CalcCatalog).

export type FurnitureType = "BUCATARIE" | "GARDEROBA" | "PIESE_MICI" | "DULAP";
export type QualityLevel = "STANDARD" | "PREMIUM";
export type FacadeMaterial =
  | "PAL"
  | "AGT_1P"
  | "AGT_2P"
  | "MDF_1P"
  | "MDF_2P"
  | "FURNIR"
  | "FURNIR_2P"
  | "RIFLAT"
  | "STICLA"
  | "OGLINDA";
export type BodyBrand = "PAL_EGGER" | "PAL_KRONO";
export type BodyFinish = "ALB" | "COLOR" | "LEMN";
export type GlassKind = "SIMPLA" | "DIAMOND" | "TONATA";
export type DrawerBrand = "blum" | "hettich";
export type DrawerMaterial = "metal" | "lemn";
export type WorktopMaterial = "PAL_EGGER" | "HPL_NEGRU" | "HPL_ALB";

export interface CalcCatalogData {
  cursEuro: number;
  /** Coeficienți de multiplicare per tip mobilier (cost → preț de ofertare) */
  coefficients: Record<FurnitureType, number>;
  /** Coeficient suplimentar pentru nivel PREMIUM [NOU] */
  premiumCoefficient: number;
  /** Coeficient aplicat corpului pentru adâncime 900mm */
  depth900Coefficient: number;
  /** Prețuri fațadă MDL / m² */
  facadePrices: Record<FacadeMaterial, number>;
  /** Prețuri corp MDL / m², per brand × finisaj [NOU] */
  bodyPrices: Record<BodyBrand, Record<BodyFinish, number>>;
  /** Sertare MDL / bucată */
  drawerPrices: Record<DrawerBrand, Record<DrawerMaterial, number>>;
  /** Mecanisme MDL / bucată */
  mechanisms: {
    blum: Record<string, number>;
    hettich: Record<string, number>;
    kessebohmer: Record<string, number>;
  };
  /** Sticlă / oglindă (pasul 6) MDL / m², per tip [NOU] */
  glassPrices: Record<GlassKind, number>;
  mirrorPrices: Record<GlassKind, number>;
  /** Blat (suprafață de lucru) MDL / m² */
  worktopPrices: Record<WorktopMaterial, number>;
  /** Organizatoare MDL / bucată */
  organizerPrices: Record<string, number>;
}

export const MECHANISM_LABELS: Record<string, string> = {
  aventos_hs: "Aventos HS",
  aventos_hl: "Aventos HL",
  aventos_hk: "Aventos HK",
  aventos_hk_xs: "Aventos HK-XS",
  aventos_hf: "Aventos HF",
  piston_gaz: "Piston gaz",
  wing_line: "Wing Line",
  top_line: "Top Line",
  glisare: "Glisare",
  colt_450: "Mecanism de colț 450",
  colt_600: "Mecanism de colț 600",
  cleaning_agent: "Cleaning Agent",
  cooking_agent: "Cooking Agent",
  dispensa: "Dispensa",
};

export const ORGANIZER_LABELS: Record<string, string> = {
  incaltaminte_8: "Încălțăminte 8",
  incaltaminte_12: "Încălțăminte 12",
  pantaloni_600: "Pantaloni 600",
  pantaloni_800: "Pantaloni 800",
  pantaloni_900: "Pantaloni 900",
};

export const FACADE_LABELS: Record<FacadeMaterial, string> = {
  PAL: "PAL",
  AGT_1P: "AGT 1P",
  AGT_2P: "AGT 2P",
  MDF_1P: "MDF 1P",
  MDF_2P: "MDF 2P",
  FURNIR: "Furnir",
  FURNIR_2P: "Furnir 2P",
  RIFLAT: "Riflat",
  STICLA: "Sticlă",
  OGLINDA: "Oglindă",
};

export const FURNITURE_LABELS: Record<FurnitureType, string> = {
  BUCATARIE: "Bucătărie",
  GARDEROBA: "Garderobă",
  PIESE_MICI: "Piese mici",
  DULAP: "Dulap",
};

export const BODY_BRAND_LABELS: Record<BodyBrand, string> = {
  PAL_EGGER: "PAL Egger",
  PAL_KRONO: "PAL Krono",
};

export const BODY_FINISH_LABELS: Record<BodyFinish, string> = {
  ALB: "Alb",
  COLOR: "Color",
  LEMN: "Lemn",
};

export const WORKTOP_LABELS: Record<WorktopMaterial, string> = {
  PAL_EGGER: "PAL Egger",
  HPL_NEGRU: "HPL Negru",
  HPL_ALB: "HPL Alb",
};

export const GLASS_LABELS: Record<GlassKind, string> = {
  SIMPLA: "Simplă",
  DIAMOND: "Diamond",
  TONATA: "Tonată",
};

/** Valorile exacte din catalogul existent (§19.1) + completările [NOU]. */
export const DEFAULT_CATALOG: CalcCatalogData = {
  cursEuro: 20.1147,
  coefficients: {
    BUCATARIE: 2.3,
    GARDEROBA: 2.1,
    PIESE_MICI: 2.5,
    DULAP: 2.2,
  },
  premiumCoefficient: 1.2,
  depth900Coefficient: 1.35,
  facadePrices: {
    PAL: 250,
    AGT_1P: 650,
    AGT_2P: 750,
    MDF_1P: 1800,
    MDF_2P: 2040,
    FURNIR: 2800,
    FURNIR_2P: 3200,
    RIFLAT: 3600,
    STICLA: 89,
    OGLINDA: 78,
  },
  bodyPrices: {
    PAL_EGGER: { ALB: 220, COLOR: 260, LEMN: 300 },
    PAL_KRONO: { ALB: 180, COLOR: 210, LEMN: 240 },
  },
  drawerPrices: {
    blum: { metal: 1100, lemn: 380 },
    hettich: { metal: 750, lemn: 350 },
  },
  mechanisms: {
    blum: {
      aventos_hs: 0,
      aventos_hl: 0,
      aventos_hk: 0,
      aventos_hk_xs: 400,
      aventos_hf: 0,
      piston_gaz: 2100,
    },
    hettich: { wing_line: 0, top_line: 0, glisare: 0 },
    kessebohmer: {
      colt_450: 0,
      colt_600: 0,
      cleaning_agent: 0,
      cooking_agent: 0,
      dispensa: 0,
    },
  },
  glassPrices: { SIMPLA: 950, DIAMOND: 1400, TONATA: 1200 },
  mirrorPrices: { SIMPLA: 780, DIAMOND: 1250, TONATA: 1100 },
  worktopPrices: { PAL_EGGER: 850, HPL_NEGRU: 1450, HPL_ALB: 1450 },
  organizerPrices: {
    incaltaminte_8: 6100,
    incaltaminte_12: 7050,
    pantaloni_600: 2300,
    pantaloni_800: 2650,
    pantaloni_900: 3000,
  },
};
