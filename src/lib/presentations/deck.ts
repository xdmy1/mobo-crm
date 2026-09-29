// ȘABLONUL prezentării Mobo — singurul loc în care se decide cum arată o prezentare.
// Orice client, orice număr de proiecte, RO sau RU: aceleași slide-uri, aceeași ordine,
// aceeași identitate. PPTX-ul și PDF-ul sunt doar două randări ale acestei scene.
//
// Povestea: Copertă → De ce Mobo → Cum lucrăm → câte un slide per proiect →
//           Ce primești → Investiția → Plăți → Mulțumim + contact.

import fs from "fs";
import QRCode from "qrcode";
import { fmtEur, fmtLei } from "@/lib/format";
import { BRAND, PHOTOS, PT, PUB, TEMPLATE_PHOTOS, type PresentationData } from "./data";
import { SH, SW, type Deck, type Node, type Slide } from "./scene";

const M = 0.8; // marginea laterală
const RIGHT = SW - M;
const CW = RIGHT - M; // lățimea utilă

const B = BRAND;

/* ───────── pictograme (contur, stil lucide) ───────── */
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  ruler:
    '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  cube:
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  file:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  hammer:
    '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
} as const;

const icon = (name: keyof typeof ICONS, color: string, strokeWidth = 1.7) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const pad2 = (n: number) => String(n).padStart(2, "0");
const upper = (s: string) => s.toLocaleUpperCase("ro-RO");

/** mărimea titlului scade cu lungimea textului — un nume lung nu rupe niciodată macheta */
function fit(text: string, steps: Array<[maxChars: number, size: number]>, min: number): number {
  for (const [max, size] of steps) if (text.length <= max) return size;
  return min;
}

interface Draft {
  slide: Slide;
  dark: boolean;
  /** de unde începe subsolul (slide-urile de proiect au fotografia pe toată înălțimea în stânga) */
  chromeX?: number;
  chrome: boolean;
}

export async function buildDeck(d: PresentationData): Promise<Deck> {
  const t = PT[d.lang];
  const drafts: Draft[] = [];
  const logoLight = PUB("logomobo.png");
  const photoFor = (i: number, own?: string) =>
    own && fs.existsSync(own) ? own : PHOTOS[i % PHOTOS.length];
  let section = 0;
  const kickerNo = (label: string) => `${pad2(++section)} — ${upper(label)}`;

  /* ═════════ 1 · Coperta ═════════ */
  {
    const n: Node[] = [];
    if (d.includePhotos)
      n.push({ t: "image", src: TEMPLATE_PHOTOS.cover, x: 0, y: 0, w: SW, h: SH, scrim: "cover" });
    n.push({ t: "image", src: logoLight, fit: "contain", x: M, y: 0.72, w: 1.86, h: 0.64, anim: 1, fx: "fade" });
    n.push({
      t: "text", text: `${upper(t.offerNo)}  ·  ${d.dateText}`, x: RIGHT - 5, y: 0.9, w: 5, h: 0.3,
      size: 10, weight: "medium", color: B.white, align: "right", tracking: 2, anim: 1, fx: "fade",
    });
    n.push({ t: "rect", x: M, y: 2.72, w: 0.62, h: 0.055, fill: B.lime, anim: 2, fx: "wipe" });
    n.push({
      t: "text", text: t.coverKicker, x: M, y: 2.95, w: 8, h: 0.32,
      size: 11, weight: "semibold", color: B.lime, tracking: 3, anim: 2,
    });
    n.push({
      t: "text", text: d.clientName, x: M - 0.04, y: 3.32, w: 8.4, h: 1.95,
      size: fit(d.clientName, [[10, 76], [16, 64], [24, 50], [34, 40]], 32),
      weight: "bold", color: B.white, tracking: -1.2, lh: 1.04, valign: "top", anim: 3,
    });
    n.push({
      t: "text", x: M, y: 5.42, w: 8, h: 0.34, size: 14, color: B.mutedOnInk, anim: 4,
      text: [
        { text: `${t.coverFor} ` },
        { text: d.clientName, color: B.white, weight: "medium" },
        { text: `   ·   ID ${d.humanId}` },
      ],
    });
    n.push({ t: "line", x: M, y: 6.72, w: CW, h: 0, color: "FFFFFF", width: 0.5, anim: 5, fx: "fade" });
    n.push({
      t: "text", text: t.coverTag, x: M, y: 6.86, w: 8.5, h: 0.3,
      size: 10.5, color: B.mutedOnInk, anim: 5, fx: "fade",
    });
    n.push({
      t: "text", text: "mobo.md", x: RIGHT - 3, y: 6.86, w: 3, h: 0.3,
      size: 10.5, weight: "medium", color: B.white, align: "right", anim: 5, fx: "fade",
    });
    drafts.push({ slide: { bg: B.ink, nodes: n, transition: "fade" }, dark: true, chrome: false });
  }

  /* ═════════ 2 · De ce Mobo ═════════ */
  {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secAbout), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.oliva, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.aboutTitle, x: M - 0.03, y: 1.26, w: 6.2, h: 0.95, size: 44, weight: "bold", color: B.ink, tracking: -0.9, anim: 1 });
    n.push({ t: "text", text: t.aboutLead, x: M, y: 2.38, w: 5.75, h: 1.05, size: 14.5, color: B.muted, lh: 1.5, anim: 2 });

    const stats: Array<[string, string]> = [[t.stat1t, t.stat1s], [t.stat2t, t.stat2s], [t.stat3t, t.stat3s]];
    stats.forEach(([big, small], i) => {
      const y = 3.72 + i * 0.98;
      const a = 3 + i;
      n.push({ t: "rect", x: M, y: y + 0.14, w: 0.055, h: 0.56, fill: B.lime, anim: a });
      n.push({ t: "text", text: big, x: M + 0.3, y, w: 2.35, h: 0.84, size: 23, weight: "semibold", color: B.ink, valign: "middle", tracking: -0.3, anim: a });
      n.push({ t: "text", text: small, x: M + 2.7, y, w: 3.15, h: 0.84, size: 12, color: B.muted, valign: "middle", lh: 1.4, anim: a });
      if (i < stats.length - 1) n.push({ t: "line", x: M, y: y + 0.91, w: 5.85, h: 0, color: B.boneDim, width: 0.75, anim: a, fx: "fade" });
    });

    if (d.includePhotos) {
      n.push({ t: "image", src: TEMPLATE_PHOTOS.about, x: 7.35, y: 0.8, w: RIGHT - 7.35, h: 5.85, radius: 0.22, bg: B.bone, anim: 2, fx: "fade" });
      // insigna „plutește” peste colțul fotografiei — dă adâncime
      n.push({ t: "rect", x: 6.82, y: 5.42, w: 2.7, h: 0.92, radius: 0.18, fill: B.lime, anim: 6 });
      n.push({ t: "image", svg: icon("shield", B.limeInk, 1.9), x: 7.06, y: 5.66, w: 0.44, h: 0.44, anim: 6 });
      n.push({ t: "text", text: t.badgeWarranty, x: 7.6, y: 5.42, w: 1.85, h: 0.92, size: 14.5, weight: "bold", color: B.limeInk, valign: "middle", anim: 6 });
    }
    drafts.push({ slide: { bg: B.bone, nodes: n, transition: "fade" }, dark: false, chrome: true });
  }

  /* ═════════ 3 · Cum lucrăm ═════════ */
  {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secProcess), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.lime, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.processTitle, x: M - 0.03, y: 1.26, w: 10.5, h: 0.95, size: 40, weight: "bold", color: B.white, tracking: -0.8, anim: 1 });

    const steps: Array<[keyof typeof ICONS, string, string]> = [
      ["ruler", t.p1t, t.p1s],
      ["cube", t.p2t, t.p2s],
      ["file", t.p3t, t.p3s],
      ["hammer", t.p4t, t.p4s],
      ["truck", t.p5t, t.p5s],
    ];
    const colW = CW / steps.length;
    const dot = 0.72;
    const lineY = 3.6;
    n.push({ t: "line", x: M + dot / 2, y: lineY, w: colW * (steps.length - 1), h: 0, color: B.inkLine, width: 1.5, anim: 2, fx: "wipe" });
    steps.forEach(([ic, title, body], i) => {
      const x = M + i * colW;
      const a = 3 + i;
      n.push({ t: "image", svg: icon(ic, B.mutedOnInk, 1.5), x: x + 0.13, y: 2.55, w: 0.46, h: 0.46, anim: a });
      n.push({ t: "ellipse", x, y: lineY - dot / 2, w: dot, h: dot, fill: B.lime, anim: a });
      n.push({ t: "text", text: String(i + 1), x, y: lineY - dot / 2, w: dot, h: dot, size: 16, weight: "bold", color: B.limeInk, align: "center", valign: "middle", anim: a });
      n.push({ t: "text", text: title, x, y: 4.22, w: colW - 0.3, h: 0.72, size: 15.5, weight: "semibold", color: B.white, lh: 1.25, valign: "top", anim: a });
      n.push({ t: "text", text: body, x, y: 4.98, w: colW - 0.35, h: 1.6, size: 11.5, color: B.mutedOnInk, lh: 1.5, valign: "top", anim: a });
    });
    drafts.push({ slide: { bg: B.ink, nodes: n, transition: "fade" }, dark: true, chrome: true });
  }

  /* ═════════ Portofoliu ═════════ */
  if (d.includePhotos) {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secPortfolio), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.oliva, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.portfolioTitle, x: M - 0.03, y: 1.24, w: 7, h: 0.85, size: 38, weight: "bold", color: B.ink, tracking: -0.8, anim: 1 });
    n.push({ t: "text", text: t.portfolioLead, x: RIGHT - 4.6, y: 1.3, w: 4.6, h: 0.8, size: 13, color: B.muted, lh: 1.5, valign: "middle", anim: 2 });

    const top = 2.42;
    const bottom = 6.62;
    const bigW = 7.05;
    const g = 0.28;
    const smallX = M + bigW + g;
    const smallW = RIGHT - smallX;
    const smallH = (bottom - top - g) / 2;
    const tiles: Array<[string, string, number, number, number, number]> = [
      [TEMPLATE_PHOTOS.gallery[0], t.g1, M, top, bigW, bottom - top],
      [TEMPLATE_PHOTOS.gallery[1], t.g2, smallX, top, smallW, smallH],
      [TEMPLATE_PHOTOS.gallery[2], t.g3, smallX, top + smallH + g, smallW, smallH],
    ];
    tiles.forEach(([src, label, x, y, w, h], i) => {
      n.push({ t: "image", src, x, y, w, h, radius: 0.22, bg: B.bone, scrim: "caption", anim: 3 + i, fx: "fade" });
      n.push({ t: "text", text: upper(label), x: x + 0.34, y: y + h - 0.56, w: w - 0.6, h: 0.3, size: 10.5, weight: "semibold", color: B.white, tracking: 2.4, anim: 3 + i, fx: "fade" });
    });
    drafts.push({ slide: { bg: B.bone, nodes: n, transition: "fade" }, dark: false, chrome: true });
  }

  /* ═════════ 4…n · Proiectele clientului ═════════ */
  d.projects.forEach((p, i) => {
    const n: Node[] = [];
    const X0 = d.includePhotos ? 6.5 : M;
    const W = RIGHT - X0;
    if (d.includePhotos) {
      n.push({ t: "image", src: photoFor(i + 1, p.photo), x: 0, y: 0, w: 5.7, h: SH, scrim: "bottom", anim: 1, fx: "fade" });
      n.push({ t: "text", text: pad2(i + 1), x: 0.55, y: 5.55, w: 2.5, h: 1.0, size: 60, weight: "bold", color: B.white, tracking: -2, valign: "bottom", anim: 2 });
      n.push({ t: "text", text: upper(p.room), x: 0.6, y: 6.62, w: 4.6, h: 0.3, size: 10.5, weight: "semibold", color: B.lime, tracking: 2.6, anim: 2 });
    }
    n.push({ t: "text", text: `${upper(t.projectKicker)} ${pad2(i + 1)} / ${pad2(d.projects.length)}`, x: X0, y: 0.82, w: W, h: 0.3, size: 10.5, weight: "semibold", color: B.oliva, tracking: 2.4, anim: 2 });
    n.push({
      t: "text", text: p.name, x: X0 - 0.03, y: 1.14, w: W, h: 1.2,
      size: fit(p.name, [[16, 40], [26, 34], [40, 28]], 23), weight: "bold", color: B.ink, tracking: -0.7, lh: 1.08, valign: "top", anim: 2,
    });

    n.push({ t: "text", text: upper(t.specs), x: X0, y: 2.42, w: W, h: 0.26, size: 9.5, weight: "semibold", color: B.muted, tracking: 2.2, anim: 3 });
    n.push({ t: "line", x: X0, y: 2.74, w: W, h: 0, color: B.boneDim, width: 0.75, anim: 3, fx: "fade" });
    if (p.specs.length === 0) {
      // proiect fără estimare detaliată: spațiul nu rămâne gol, arătăm ce include
      n.push({ t: "text", text: t.noSpecs, x: X0, y: 2.92, w: W, h: 0.5, size: 14, color: B.muted, lh: 1.5, anim: 4 });
      [t.i2t, t.i3t, t.i5t, t.i6t].forEach((line, r) => {
        const y = 3.62 + r * 0.44;
        n.push({ t: "ellipse", x: X0, y: y + 0.06, w: 0.28, h: 0.28, fill: B.lime, anim: 5 });
        n.push({ t: "image", svg: icon("check", B.limeInk, 2.6), x: X0 + 0.065, y: y + 0.125, w: 0.15, h: 0.15, anim: 5 });
        n.push({ t: "text", text: line, x: X0 + 0.46, y, w: W - 0.46, h: 0.4, size: 13, weight: "medium", color: B.ink, valign: "middle", anim: 5 });
      });
    }
    p.specs.slice(0, 6).forEach((line, r) => {
      const y = 2.74 + r * 0.45;
      const cut = line.indexOf(":");
      const label = cut > 0 ? line.slice(0, cut).trim() : "";
      const value = cut > 0 ? line.slice(cut + 1).trim() : line;
      const a = 4 + Math.floor(r / 2);
      n.push({ t: "text", text: label, x: X0, y, w: 1.7, h: 0.45, size: 11.5, color: B.muted, valign: "middle", anim: a });
      n.push({ t: "text", text: value, x: X0 + 1.75, y, w: W - 1.75, h: 0.45, size: 13, weight: "medium", color: B.ink, valign: "middle", anim: a });
      n.push({ t: "line", x: X0, y: y + 0.45, w: W, h: 0, color: B.boneDim, width: 0.75, anim: a, fx: "fade" });
    });

    // caseta de preț — singurul lime mare de pe slide, ca ochiul să ajungă la ea
    const py = 5.62;
    n.push({ t: "rect", x: X0, y: py, w: W, h: 0.98, radius: 0.18, fill: B.lime, anim: 7 });
    n.push({ t: "text", text: upper(t.price), x: X0 + 0.32, y: py + 0.15, w: 3, h: 0.24, size: 9, weight: "bold", color: B.limeInk, tracking: 2.2, anim: 7 });
    n.push({ t: "text", text: fmtEur(p.priceEur), x: X0 + 0.3, y: py + 0.36, w: W * 0.58, h: 0.52, size: 27, weight: "bold", color: B.limeInk, tracking: -0.6, valign: "middle", anim: 7 });
    n.push({ t: "text", text: fmtLei(p.priceMdl), x: X0 + W * 0.5, y: py + 0.36, w: W * 0.5 - 0.32, h: 0.52, size: 14, weight: "medium", color: B.limeInk, align: "right", valign: "middle", anim: 7 });

    drafts.push({
      slide: { bg: B.bone, nodes: n, transition: i === 0 ? "fade" : "push" },
      dark: false,
      chrome: true,
      chromeX: X0,
    });
  });

  /* ═════════ Ce primești ═════════ */
  {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secIncluded), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.oliva, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.includedTitle, x: M - 0.03, y: 1.24, w: 10.5, h: 0.85, size: 38, weight: "bold", color: B.ink, tracking: -0.8, anim: 1 });
    n.push({ t: "text", text: t.includedLead, x: M, y: 2.1, w: 9, h: 0.4, size: 14.5, color: B.muted, anim: 2 });

    const items: Array<[keyof typeof ICONS, string, string]> = [
      ["ruler", t.i1t, t.i1s],
      ["cube", t.i2t, t.i2s],
      ["hammer", t.i3t, t.i3s],
      ["truck", t.i4t, t.i4s],
      ["wrench", t.i5t, t.i5s],
      ["shield", t.i6t, t.i6s],
    ];
    const gap = 0.3;
    const cw = (CW - gap * 2) / 3;
    const ch = 1.66;
    items.forEach(([ic, title, body], i) => {
      const x = M + (i % 3) * (cw + gap);
      const y = 3.0 + Math.floor(i / 3) * (ch + gap);
      const a = 3 + i;
      n.push({ t: "rect", x, y, w: cw, h: ch, radius: 0.18, fill: B.white, stroke: B.boneDim, strokeW: 0.75, anim: a });
      n.push({ t: "rect", x: x + 0.3, y: y + 0.3, w: 0.62, h: 0.62, radius: 0.15, fill: B.lime, anim: a });
      n.push({ t: "image", svg: icon(ic, B.limeInk, 1.8), x: x + 0.45, y: y + 0.45, w: 0.32, h: 0.32, anim: a });
      n.push({ t: "text", text: title, x: x + 1.14, y: y + 0.3, w: cw - 1.4, h: 0.42, size: fit(title, [[21, 15.5]], 13), weight: "semibold", color: B.ink, valign: "middle", lh: 1.15, anim: a });
      n.push({ t: "text", text: body, x: x + 1.14, y: y + 0.78, w: cw - 1.42, h: 0.8, size: 12, color: B.muted, lh: 1.45, valign: "top", anim: a });
    });
    drafts.push({ slide: { bg: B.bone, nodes: n, transition: "fade" }, dark: false, chrome: true });
  }

  /* ═════════ Investiția ═════════ */
  {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secInvest), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.lime, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.invTitle, x: M - 0.03, y: 1.24, w: 8, h: 0.85, size: 38, weight: "bold", color: B.white, tracking: -0.8, anim: 1 });
    if (d.validUntilText) {
      n.push({ t: "rect", x: RIGHT - 3.75, y: 1.42, w: 3.75, h: 0.46, radius: 0.23, stroke: B.inkLine, strokeW: 1, anim: 1, fx: "fade" });
      n.push({ t: "text", text: `${t.validUntil} ${d.validUntilText}`, x: RIGHT - 3.75, y: 1.42, w: 3.75, h: 0.46, size: 10.5, color: B.mutedOnInk, align: "center", valign: "middle", anim: 1, fx: "fade" });
    }

    // cel mult 6 rânduri; restul proiectelor se adună într-un rând, ca totalul să rămână mereu pe slide
    const MAX = 6;
    const shown = d.projects.length > MAX ? d.projects.slice(0, MAX - 1) : d.projects;
    const rest = d.projects.slice(shown.length);
    const rows = [
      ...shown.map((p) => ({ name: p.name, room: p.room, eur: p.priceEur, lei: p.priceMdl })),
      ...(rest.length
        ? [{
            name: `+ ${rest.length} ${t.moreProjects}`,
            room: "",
            eur: rest.reduce((s, p) => s + p.priceEur, 0),
            lei: rest.reduce((s, p) => s + p.priceMdl, 0),
          }]
        : []),
    ];

    const headY = 2.42;
    const head = (text: string, x: number, w: number, align: "left" | "right" = "left") =>
      n.push({ t: "text", text: upper(text), x, y: headY, w, h: 0.26, size: 9.5, weight: "semibold", color: B.mutedOnInk, tracking: 2, align, anim: 2, fx: "fade" });
    head(t.invProject, M, 5);
    head(t.invRoom, M + 5.4, 2.5);
    head(t.invPrice, RIGHT - 4, 4, "right");
    n.push({ t: "line", x: M, y: headY + 0.34, w: CW, h: 0, color: B.inkLine, width: 1, anim: 2, fx: "fade" });

    const rowH = 0.52;
    let y = headY + 0.34;
    rows.forEach((r, i) => {
      const a = 3 + Math.floor(i / 2);
      n.push({ t: "text", text: r.name, x: M, y, w: 5.2, h: rowH, size: 14.5, weight: "medium", color: B.white, valign: "middle", anim: a });
      n.push({ t: "text", text: r.room, x: M + 5.4, y, w: 2.5, h: rowH, size: 12, color: B.mutedOnInk, valign: "middle", anim: a });
      n.push({
        t: "text", x: RIGHT - 5, y, w: 5, h: rowH, size: 14.5, color: B.white, align: "right", valign: "middle", anim: a,
        text: [
          { text: fmtEur(r.eur), weight: "semibold" },
          { text: `   ${fmtLei(r.lei)}`, color: B.mutedOnInk },
        ],
      });
      y += rowH;
      n.push({ t: "line", x: M, y, w: CW, h: 0, color: B.inkLine, width: 0.75, anim: a, fx: "fade" });
    });

    const ty = Math.min(y + 0.38, 5.72);
    n.push({ t: "rect", x: M, y: ty, w: CW, h: 1.05, radius: 0.2, fill: B.lime, anim: 6 });
    n.push({ t: "text", text: upper(t.invTotal), x: M + 0.4, y: ty, w: 3, h: 1.05, size: 12.5, weight: "bold", color: B.limeInk, tracking: 2.6, valign: "middle", anim: 6 });
    n.push({ t: "text", text: fmtLei(d.totalMdl), x: M + 3, y: ty, w: 4.1, h: 1.05, size: 15, weight: "medium", color: B.limeInk, align: "right", valign: "middle", anim: 6 });
    n.push({ t: "text", text: fmtEur(d.totalEur), x: RIGHT - 4.5, y: ty, w: 4.1, h: 1.05, size: 32, weight: "bold", color: B.limeInk, tracking: -0.8, align: "right", valign: "middle", anim: 6 });
    drafts.push({ slide: { bg: B.ink, nodes: n, transition: "fade" }, dark: true, chrome: true });
  }

  /* ═════════ Plăți ═════════ */
  if (d.includeStages && d.totalEur > 0) {
    const n: Node[] = [];
    n.push({ t: "text", text: kickerNo(t.secPayments), x: M, y: 0.92, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.oliva, tracking: 2.4, anim: 1 });
    n.push({ t: "text", text: t.stagesTitle, x: M - 0.03, y: 1.24, w: 10.5, h: 0.85, size: 38, weight: "bold", color: B.ink, tracking: -0.8, anim: 1 });

    const stages: Array<[string, number, string, string]> = [
      [t.stage1, 0.5, B.lime, B.limeInk],
      [t.stage2, 0.3, B.ink, B.white],
      [t.stage3, 0.2, "8C8E80", B.white],
    ];
    const gap = 0.12;
    let x = M;
    stages.forEach(([label, pct, fill], i) => {
      const w = CW * pct - (i < stages.length - 1 ? gap : 0);
      const a = 2 + i;
      // bara e împărțită exact ca plata: se vede dintr-o privire cât și când
      n.push({ t: "rect", x, y: 2.62, w, h: 0.4, radius: 0.12, fill, anim: a, fx: "wipe" });
      n.push({ t: "rect", x, y: 3.24, w, h: 3.32, radius: 0.2, fill: B.white, stroke: B.boneDim, strokeW: 0.75, anim: a });
      const ix = x + 0.32;
      const iw = w - 0.5;
      n.push({ t: "text", text: `${upper(t.stageWord)} ${i + 1}`, x: ix, y: 3.52, w: iw, h: 0.26, size: 9.5, weight: "semibold", color: B.oliva, tracking: 2.2, anim: a });
      n.push({ t: "text", text: `${Math.round(pct * 100)}%`, x: ix - 0.04, y: 3.8, w: iw, h: 0.95, size: 52, weight: "bold", color: B.ink, tracking: -2, valign: "top", anim: a });
      n.push({ t: "text", text: label, x: ix, y: 4.78, w: iw, h: 0.8, size: 12.5, color: B.muted, lh: 1.4, valign: "top", anim: a });
      n.push({ t: "text", text: fmtEur(d.totalEur * pct), x: ix, y: 5.62, w: iw, h: 0.4, size: 18, weight: "semibold", color: B.ink, tracking: -0.3, valign: "middle", anim: a });
      n.push({ t: "text", text: fmtLei(d.totalMdl * pct), x: ix, y: 6.04, w: iw, h: 0.28, size: 11.5, color: B.muted, valign: "middle", anim: a });
      x += CW * pct;
    });
    drafts.push({ slide: { bg: B.bone, nodes: n, transition: "fade" }, dark: false, chrome: true });
  }

  /* ═════════ Mulțumim + contact ═════════ */
  {
    const n: Node[] = [];
    if (d.includePhotos)
      n.push({ t: "image", src: TEMPLATE_PHOTOS.closing, x: 0, y: 0, w: SW, h: SH, scrim: "leftStrong" });
    n.push({ t: "image", src: logoLight, fit: "contain", x: M, y: 0.72, w: 1.86, h: 0.64, anim: 1, fx: "fade" });
    n.push({ t: "text", text: t.thanks, x: M - 0.04, y: 1.72, w: 7, h: 1.1, size: 66, weight: "bold", color: B.white, tracking: -1.6, anim: 2 });
    n.push({ t: "text", text: t.contactTitle, x: M, y: 2.9, w: 7, h: 0.45, size: 19, color: B.mutedOnInk, anim: 2 });

    n.push({ t: "text", text: upper(t.nextTitle), x: M, y: 3.95, w: 6, h: 0.3, size: 10.5, weight: "semibold", color: B.lime, tracking: 2.4, anim: 3 });
    [t.next1, t.next2, t.next3].forEach((line, i) => {
      const y = 4.4 + i * 0.66;
      const a = 4 + i;
      n.push({ t: "ellipse", x: M, y: y + 0.04, w: 0.44, h: 0.44, fill: B.lime, anim: a });
      n.push({ t: "text", text: String(i + 1), x: M, y: y + 0.04, w: 0.44, h: 0.44, size: 12.5, weight: "bold", color: B.limeInk, align: "center", valign: "middle", anim: a });
      n.push({ t: "text", text: line, x: M + 0.66, y, w: 6.2, h: 0.52, size: 13.5, color: B.white, valign: "middle", lh: 1.3, anim: a });
    });

    // cardul de contact
    const cx = 8.3;
    const cw = RIGHT - cx;
    const ix = cx + 0.42;
    n.push({ t: "rect", x: cx, y: 1.55, w: cw, h: 5.1, radius: 0.24, fill: B.ink, opacity: 0.78, stroke: B.inkLine, strokeW: 1, anim: 3 });
    n.push({ t: "text", text: upper(d.consultant ? t.consultant : t.contactTitle), x: ix, y: 1.92, w: cw - 0.84, h: 0.28, size: 10, weight: "semibold", color: B.lime, tracking: 2.2, anim: 3 });
    n.push({
      t: "text", text: d.consultant?.name ?? d.org.name, x: ix, y: 2.24, w: cw - 0.84, h: 0.5,
      size: fit(d.consultant?.name ?? d.org.name, [[18, 22], [26, 18]], 15), weight: "semibold", color: B.white, tracking: -0.3, valign: "middle", anim: 3,
    });

    const lines: Array<[keyof typeof ICONS, string]> = (
      [
        ["phone", d.consultant?.phone || d.org.phone],
        ["mail", d.consultant?.email || d.org.email],
        ["pin", d.org.address],
        ["globe", "mobo.md"],
      ] as Array<[keyof typeof ICONS, string | null | undefined]>
    ).filter((l): l is [keyof typeof ICONS, string] => !!l[1]);
    lines.forEach(([ic, text], i) => {
      const y = 2.98 + i * 0.44;
      n.push({ t: "image", svg: icon(ic, B.lime, 1.8), x: ix, y: y + 0.07, w: 0.22, h: 0.22, anim: 4 });
      n.push({ t: "text", text, x: ix + 0.4, y, w: cw - 1.24, h: 0.36, size: 12.5, color: B.white, valign: "middle", anim: 4 });
    });

    const qy = 4.98;
    const qr = await QRCode.toBuffer("https://mobo.md", {
      margin: 0,
      width: 480,
      color: { dark: `#${B.ink}`, light: "#FFFFFF" },
    });
    n.push({ t: "rect", x: ix, y: qy, w: 1.28, h: 1.28, radius: 0.12, fill: B.white, anim: 5 });
    n.push({ t: "image", data: qr, fit: "contain", x: ix + 0.12, y: qy + 0.12, w: 1.04, h: 1.04, anim: 5 });
    n.push({ t: "text", text: t.scanSite, x: ix + 1.52, y: qy, w: cw - 2.4, h: 1.28, size: 12, color: B.mutedOnInk, lh: 1.45, valign: "middle", anim: 5 });

    drafts.push({ slide: { bg: B.ink, nodes: n, transition: "fade" }, dark: true, chrome: false });
  }

  /* ═════════ subsolul comun (după ce știm câte slide-uri sunt) ═════════ */
  const total = drafts.length;
  drafts.forEach((dr, i) => {
    if (!dr.chrome) return;
    const x0 = dr.chromeX ?? M;
    const c = dr.dark ? B.mutedOnInk : B.muted;
    const n = dr.slide.nodes;
    n.push({ t: "line", x: x0, y: 6.9, w: RIGHT - x0, h: 0, color: dr.dark ? B.inkLine : B.boneDim, width: 0.75 });
    n.push({ t: "image", src: PUB("mobo-icon.png"), fit: "contain", x: x0, y: 7.03, w: 0.23, h: 0.255 });
    n.push({ t: "text", text: `${d.org.name}  ·  ${d.clientName}`, x: x0 + 0.34, y: 7.02, w: 6, h: 0.28, size: 9.5, color: c, valign: "middle" });
    n.push({ t: "text", text: `${pad2(i + 1)} / ${pad2(total)}`, x: RIGHT - 1.5, y: 7.02, w: 1.5, h: 0.28, size: 9.5, weight: "medium", color: c, align: "right", valign: "middle" });
  });

  return {
    title: `${t.coverKicker} — ${d.clientName}`,
    author: d.org.name,
    slides: drafts.map((dr) => dr.slide),
  };
}
