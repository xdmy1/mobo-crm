// Randarea scenei în PDF (pdfkit): o pagină 16:9 per slide, font Geist încorporat —
// arată identic pe orice telefon sau calculator, fără să depindă de fonturile instalate.

import path from "path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { docToBuffer } from "@/lib/pdf/core";
import { prepareImage, rasterizeSvg } from "./assets";
import { SH, SW, type Deck, type Node, type TextRun, type Weight } from "./scene";

const PT = 72; // puncte per inch
const FONT_DIR = path.join(process.cwd(), "public", "fonts", "geist");
const FONT_FILE: Record<Weight, string> = {
  light: "Geist-Light.ttf",
  regular: "Geist-Regular.ttf",
  medium: "Geist-Medium.ttf",
  semibold: "Geist-SemiBold.ttf",
  bold: "Geist-Bold.ttf",
};

const c = (hex: string) => `#${hex}`;

type TextNode = Extract<Node, { t: "text" }>;
type ImageNode = Extract<Node, { t: "image" }>;

function drawText(doc: PDFKit.PDFDocument, n: TextNode) {
  const x = n.x * PT;
  const y = n.y * PT;
  const w = n.w * PT;
  const h = n.h * PT;
  const base: Weight = n.weight ?? "regular";
  const runs: TextRun[] = typeof n.text === "string" ? [{ text: n.text }] : n.text;
  const tracking = n.tracking ?? 0;

  doc.font(base).fontSize(n.size);
  const natural = doc.currentLineHeight();
  const lineGap = n.size * (n.lh ?? 1.2) - natural;

  // mai multe fragmente (culori/grosimi diferite) = un singur rând, așezat manual:
  // `continued` din pdfkit nu aliniază corect la dreapta fragmente cu fonturi diferite
  if (runs.length > 1) {
    const widths = runs.map((r) => {
      doc.font(r.weight ?? base).fontSize(n.size);
      return doc.widthOfString(r.text, { characterSpacing: tracking });
    });
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = n.align === "right" ? x + w - total : n.align === "center" ? x + (w - total) / 2 : x;
    const cy = n.valign === "middle" ? y + (h - natural) / 2 : n.valign === "bottom" ? y + h - natural : y;
    runs.forEach((r, i) => {
      doc
        .font(r.weight ?? base)
        .fontSize(n.size)
        .fillColor(c(r.color ?? n.color))
        .text(r.text, cx, cy, { lineBreak: false, characterSpacing: tracking });
      cx += widths[i];
    });
    return;
  }

  const text = runs[0]?.text ?? "";
  if (!text) return;
  const opts = { width: w, align: n.align ?? "left", characterSpacing: tracking, lineGap } as const;
  const textH = doc.heightOfString(text, opts) - lineGap; // fără golul de după ultimul rând
  const ty = n.valign === "middle" ? y + (h - textH) / 2 : n.valign === "bottom" ? y + h - textH : y;
  doc.fillColor(c(n.color)).text(text, x, ty, opts);
}

async function drawImage(doc: PDFKit.PDFDocument, n: ImageNode) {
  const x = n.x * PT;
  const y = n.y * PT;
  const w = n.w * PT;
  const h = n.h * PT;
  if (n.svg) {
    const img = await rasterizeSvg(n.svg, n.w, n.h);
    doc.image(img.data, x, y, { fit: [w, h], align: "center", valign: "center" });
    return;
  }
  if (n.data) {
    doc.image(n.data, x, y, { fit: [w, h], align: "center", valign: "center" });
    return;
  }
  if (!n.src) return;
  const img = await prepareImage(n.src, n.w, n.h, n);
  if (!img) return;
  if (n.fit === "contain") doc.image(img.data, x, y, { fit: [w, h], align: "center", valign: "center" });
  else doc.image(img.data, x, y, { width: w, height: h });
}

export async function renderDeckPdf(deck: Deck): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [SW * PT, SH * PT],
    margin: 0,
    autoFirstPage: false,
    info: { Title: deck.title, Author: deck.author, Creator: "MOBO CRM" },
  });
  for (const [weight, file] of Object.entries(FONT_FILE)) doc.registerFont(weight, path.join(FONT_DIR, file));

  for (const slide of deck.slides) {
    doc.addPage();
    doc.rect(0, 0, SW * PT, SH * PT).fill(c(slide.bg));

    for (const n of slide.nodes) {
      const x = n.x * PT;
      const y = n.y * PT;
      const w = n.w * PT;
      const h = n.h * PT;
      switch (n.t) {
        case "rect": {
          doc.save();
          if (n.opacity != null) doc.fillOpacity(n.opacity);
          const shape = () => (n.radius ? doc.roundedRect(x, y, w, h, n.radius * PT) : doc.rect(x, y, w, h));
          if (n.fill && n.stroke) shape().lineWidth(n.strokeW ?? 1).fillAndStroke(c(n.fill), c(n.stroke));
          else if (n.fill) shape().fill(c(n.fill));
          else if (n.stroke) shape().lineWidth(n.strokeW ?? 1).stroke(c(n.stroke));
          doc.restore();
          break;
        }
        case "ellipse": {
          const e = doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
          if (n.fill) e.fill(c(n.fill));
          else if (n.stroke) e.lineWidth(n.strokeW ?? 1).stroke(c(n.stroke));
          break;
        }
        case "line":
          doc.save();
          // linia albă de pe copertă e un fir discret, nu o bară
          if (n.color === "FFFFFF") doc.strokeOpacity(0.22);
          doc.moveTo(x, y).lineTo(x + w, y + h).lineWidth(n.width ?? 1).stroke(c(n.color));
          doc.restore();
          break;
        case "text":
          drawText(doc, n);
          break;
        case "image":
          await drawImage(doc, n);
          break;
      }
    }
  }
  return docToBuffer(doc);
}

/** dimensiunile reale ale unei imagini (pentru încadrarea „contain” din PPTX) */
export async function imageSize(data: Buffer): Promise<{ w: number; h: number }> {
  const meta = await sharp(data).metadata();
  return { w: meta.width ?? 1, h: meta.height ?? 1 };
}
