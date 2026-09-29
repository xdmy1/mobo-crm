// Generatoare PDF: Contract (RO/RU), Ofertă (RO/RU), Estimare tehnică (tabel).

import { drawFooter, docToBuffer, drawHeader, newDoc } from "./core";
import { T, tpl, type Lang } from "./texts";
import { fmtDate, fmtEur, fmtLei, fmtEurLei, fmtNumber, EMPTY } from "@/lib/format";
import type { QuoteConfig } from "@/lib/calc/engine";
import { computeQuote } from "@/lib/calc/engine";
import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  FURNITURE_LABELS,
  WORKTOP_LABELS,
  type CalcCatalogData,
} from "@/lib/calc/catalog";

interface OrgInfo {
  name: string;
  idno?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ContractData {
  number: number;
  lang: Lang;
  org: OrgInfo;
  clientName: string;
  clientIdnp?: string | null;
  clientAddress?: string | null;
  clientPhone?: string | null;
  isCompany?: boolean;
  retribution: number;
  financialGuarantee: number;
  beneficiaryPercent: number;
  rooms: Array<{ name: string; sum: string }>;
  projects: Array<{ name: string; room: string; sum: string }>;
}

export async function generateContractPdf(d: ContractData): Promise<Buffer> {
  const t = T[d.lang];
  const doc = newDoc();
  drawHeader(doc, d.org.name, `${d.org.address ?? ""} · ${d.org.phone ?? ""} · ${d.org.email ?? ""}`);

  doc.font("bold").fontSize(13).text(t.contractTitle, { align: "center" });
  doc
    .font("body")
    .fontSize(10)
    .text(`${t.contractNo} ${d.number} · ${t.date}: ${fmtDate(new Date())}`, {
      align: "center",
    });
  doc.moveDown(1.2);

  doc.fontSize(10);
  doc.font("bold").text(`${t.executor}: `, { continued: true });
  doc
    .font("body")
    .text(`${d.org.name}${d.org.idno ? `, ${t.idno} ${d.org.idno}` : ""}${d.org.address ? `, ${d.org.address}` : ""}`);
  doc.font("bold").text(`${d.isCompany ? t.company : t.client}: `, { continued: true });
  doc
    .font("body")
    .text(
      `${d.clientName}${d.clientIdnp ? `, ${d.isCompany ? t.idno : t.idnp} ${d.clientIdnp}` : ""}${
        d.clientAddress ? `, ${t.address}: ${d.clientAddress}` : ""
      }${d.clientPhone ? `, ${t.phone}: ${d.clientPhone}` : ""}`
    );
  doc.moveDown(1);

  const section = (title: string, body: string) => {
    doc.font("bold").fontSize(11).text(title);
    doc.moveDown(0.3);
    doc.font("body").fontSize(10).text(body, { align: "justify", lineGap: 2 });
    doc.moveDown(0.8);
  };
  section(t.object, t.objectText);
  section(
    t.priceTitle,
    // textul juridic conține deja „EUR” după {price} → aceeași cifră ca în aplicație, fără simbol
    tpl(t.priceText, { price: fmtEur(d.retribution).replace(/\s*€$/, "") })
  );
  section(
    t.guaranteeTitle,
    tpl(t.guaranteeText, {
      guarantee: d.financialGuarantee,
      beneficiary: d.beneficiaryPercent,
    })
  );
  section(t.termsTitle, t.termsText);

  // Anexă
  doc.moveDown(0.5);
  doc.font("bold").fontSize(11).text(t.annexTitle);
  doc.moveDown(0.4);
  const startX = 50;
  const cols = [220, 180, 95];
  const headers = [t.project, t.room, t.sum];
  let y = doc.y;
  doc.save().rect(startX, y - 2, 495, 18).fill("#f0efe8").restore();
  doc.font("bold").fontSize(9);
  headers.forEach((h, i) => {
    doc.text(h, startX + cols.slice(0, i).reduce((a, b) => a + b, 0) + 4, y + 2, {
      width: cols[i] - 8,
    });
  });
  y += 18;
  doc.font("body").fontSize(9);
  for (const p of d.projects) {
    doc.text(p.name, startX + 4, y + 2, { width: cols[0] - 8 });
    doc.text(p.room, startX + cols[0] + 4, y + 2, { width: cols[1] - 8 });
    doc.text(p.sum, startX + cols[0] + cols[1] + 4, y + 2, {
      width: cols[2] - 8,
      align: "right",
    });
    y += 16;
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
  }
  doc.y = y + 10;
  doc.x = 50;

  // Semnături
  doc.moveDown(2);
  doc.font("bold").fontSize(11).text(t.signatures, 50);
  doc.moveDown(1.5);
  const sigY = doc.y;
  doc.font("body").fontSize(10);
  doc.text(`${t.sigExecutor}: ______________________`, 50, sigY);
  doc.text(`${t.sigClient}: ______________________`, 320, sigY);
  doc.moveDown(3);
  drawFooter(doc, T[d.lang].generatedBy);

  return docToBuffer(doc);
}

export interface OfferData {
  lang: Lang;
  org: OrgInfo;
  clientName: string;
  roomName?: string | null;
  showStagePrices: boolean;
  items: Array<{ project: string; room: string; priceEur: number; priceMdl: number }>;
}

export async function generateOfferPdf(d: OfferData): Promise<Buffer> {
  const t = T[d.lang];
  const doc = newDoc();
  drawHeader(doc, d.org.name, `${d.org.address ?? ""} · ${d.org.phone ?? ""} · ${d.org.email ?? ""}`);

  doc.font("bold").fontSize(14).text(t.offerTitle, { align: "center" });
  doc.moveDown(0.5);
  doc
    .font("body")
    .fontSize(10)
    .text(`${t.offerFor}: ${d.clientName}${d.roomName ? ` · ${t.offerRoom}: ${d.roomName}` : ""}`, {
      align: "center",
    });
  doc.text(`${t.date}: ${fmtDate(new Date())}`, { align: "center" });
  doc.moveDown(1);
  doc.fontSize(10).text(t.offerIntro, { align: "justify" });
  doc.moveDown(1);

  const startX = 50;
  const cols = [210, 120, 165]; // coloana sumei e mai lată: „2.877,45 € (57.879,00 lei)”
  let y = doc.y;
  doc.save().rect(startX, y - 2, 495, 18).fill("#f0efe8").restore();
  doc.font("bold").fontSize(9);
  [t.project, t.room, t.sum].forEach((h, i) =>
    doc.text(h, startX + cols.slice(0, i).reduce((a, b) => a + b, 0) + 4, y + 2, {
      width: cols[i] - 8,
    })
  );
  y += 18;
  doc.font("body").fontSize(9);
  let totalEur = 0;
  let totalMdl = 0;
  for (const it of d.items) {
    totalEur += it.priceEur;
    totalMdl += it.priceMdl;
    doc.text(it.project, startX + 4, y + 2, { width: cols[0] - 8 });
    doc.text(it.room, startX + cols[0] + 4, y + 2, { width: cols[1] - 8 });
    doc.text(
      fmtEurLei(it.priceEur, it.priceMdl),
      startX + cols[0] + cols[1] + 4,
      y + 2,
      { width: cols[2] - 8, align: "right" }
    );
    y += 16;
  }
  doc.save().rect(startX, y, 495, 20).fill("#ccdf10").restore();
  doc.font("bold").fontSize(10).fillColor("#20211b");
  doc.text(t.total, startX + 4, y + 5);
  doc.text(fmtEurLei(totalEur, totalMdl), startX + cols[0] + cols[1] + 4, y + 5, {
    width: cols[2] - 8,
    align: "right",
  });
  y += 30;
  doc.y = y;
  doc.x = 50;

  if (d.showStagePrices && totalEur > 0) {
    doc.moveDown(1);
    doc.font("bold").fontSize(11).text(t.stagePrices, 50);
    doc.moveDown(0.4);
    doc.font("body").fontSize(10);
    doc.text(`• ${t.stageAdvance}: ${fmtEur(totalEur * 0.5)}`);
    doc.text(`• ${t.stageMeasure}: ${fmtEur(totalEur * 0.3)}`);
    doc.text(`• ${t.stageDelivery}: ${fmtEur(totalEur * 0.2)}`);
  }

  drawFooter(doc, t.generatedBy);
  return docToBuffer(doc);
}

export interface QuoteTableData {
  lang: Lang;
  org: OrgInfo;
  quoteName: string;
  projectName: string;
  clientName?: string | null;
  quoteDate: Date;
  expirationDate?: Date | null;
  config: QuoteConfig | null;
  catalog: CalcCatalogData;
  discountEur: number;
  /** totalurile SALVATE pe estimare — PDF-ul arată exact ce arată CRM-ul, chiar dacă s-a schimbat catalogul */
  stored?: { minPriceMdl: number; offerPriceMdl: number; totalPrice: number; cursEuro: number };
}

export async function generateQuoteTablePdf(d: QuoteTableData): Promise<Buffer> {
  const t = T[d.lang];
  const doc = newDoc();
  drawHeader(doc, d.org.name, `${d.org.address ?? ""} · ${d.org.phone ?? ""}`);

  doc.font("bold").fontSize(14).text(t.quoteTitle, { align: "center" });
  doc.moveDown(0.4);
  doc
    .font("body")
    .fontSize(10)
    .text(
      `${d.quoteName} · ${d.projectName}${d.clientName ? ` · ${d.clientName}` : ""}`,
      { align: "center" }
    );
  doc.text(
    `${t.date}: ${fmtDate(d.quoteDate)}${d.expirationDate ? ` · ${t.validUntil}: ${fmtDate(d.expirationDate)}` : ""}`,
    { align: "center" }
  );
  doc.moveDown(1);

  if (d.config) {
    const c = d.config;
    const specs: Array<[string, string]> = [];
    if (c.furnitureType) specs.push(["Tip", FURNITURE_LABELS[c.furnitureType]]);
    if (c.qualityLevel) specs.push(["Mod", c.qualityLevel]);
    if (c.lengthMm && c.heightMm)
      specs.push([
        "Dimensiuni",
        `${fmtNumber(c.lengthMm / 1000)} m × ${fmtNumber(c.heightMm / 1000)} m (A: ${c.depth ?? EMPTY} mm)`,
      ]);
    if (c.bodyBrand)
      specs.push([
        "Corp",
        `${BODY_BRAND_LABELS[c.bodyBrand]}${c.bodyFinish ? ` – ${BODY_FINISH_LABELS[c.bodyFinish]}` : ""}`,
      ]);
    if (c.facade) specs.push(["Fațadă", FACADE_LABELS[c.facade]]);
    if (c.worktop)
      specs.push(["Blat", `${WORKTOP_LABELS[c.worktop.material]} — ${c.worktop.sqm} m²`]);

    doc.font("body").fontSize(10);
    for (const [k, v] of specs) {
      doc.font("bold").text(`${k}: `, { continued: true }).font("body").text(v);
    }
    doc.moveDown(0.8);

    const r = computeQuote({ ...c, manualDiscountMdl: d.discountEur * d.catalog.cursEuro }, d.catalog);
    const startX = 50;
    const cols = [170, 220, 105];
    let y = doc.y;
    doc.save().rect(startX, y - 2, 495, 18).fill("#f0efe8").restore();
    doc.font("bold").fontSize(9);
    [t.component, t.details, t.cost].forEach((h, i) =>
      doc.text(h, startX + cols.slice(0, i).reduce((a, b) => a + b, 0) + 4, y + 2, {
        width: cols[i] - 8,
      })
    );
    y += 18;
    doc.font("body").fontSize(9);
    for (const b of r.breakdown) {
      doc.text(b.label, startX + 4, y + 2, { width: cols[0] - 8 });
      doc.text(b.detail, startX + cols[0] + 4, y + 2, { width: cols[1] - 8 });
      doc.text(fmtLei(b.amountMdl), startX + cols[0] + cols[1] + 4, y + 2, {
        width: cols[2] - 8,
        align: "right",
      });
      y += 16;
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
    }
    const st = d.stored;
    const curs = st?.cursEuro || d.catalog.cursEuro;
    const minMdl = st?.minPriceMdl ?? r.minPriceMdl;
    const offerMdl = st?.offerPriceMdl ?? r.offerPriceMdl;
    const totalMdl = st?.totalPrice ?? r.totalMdl;
    const totals: Array<[string, string, boolean]> = [
      [t.minPrice, fmtEurLei(minMdl / curs, minMdl), false],
      [t.offerPrice, fmtEurLei(offerMdl / curs, offerMdl), false],
      [t.discount, `−${fmtLei(Math.max(0, offerMdl - totalMdl))}`, false],
      [t.totalAfter, fmtEurLei(totalMdl / curs, totalMdl), true],
    ];
    y += 6;
    // blocul de totaluri nu se rupe între pagini
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
    for (const [k, v, hl] of totals) {
      if (hl) doc.save().rect(startX, y, 495, 20).fill("#ccdf10").restore();
      doc
        .font("bold")
        .fontSize(hl ? 10 : 9)
        .fillColor("#20211b")
        .text(k, startX + 4, y + (hl ? 5 : 3), { width: 200, lineBreak: false });
      doc.text(v, startX + 200, y + (hl ? 5 : 3), { width: 291, align: "right", lineBreak: false });
      y += hl ? 24 : 16;
    }
  }

  drawFooter(doc, t.generatedBy);
  return docToBuffer(doc);
}
