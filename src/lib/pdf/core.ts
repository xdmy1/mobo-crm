// Bază PDF (pdfkit) cu fonturi DejaVu — suportă diacritice RO + chirilice RU.

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { mkdir, writeFile } from "fs/promises";

const FONT_DIR = path.join(
  process.cwd(),
  "node_modules",
  "dejavu-fonts-ttf",
  "ttf"
);

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

export function newDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  doc.registerFont("body", path.join(FONT_DIR, "DejaVuSans.ttf"));
  doc.registerFont("bold", path.join(FONT_DIR, "DejaVuSans-Bold.ttf"));
  doc.font("body");
  return doc;
}

export function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function saveDocFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const stored = `${crypto.randomUUID()}__${fileName}`;
  await writeFile(path.join(UPLOADS_DIR, stored), buffer);
  return stored;
}

const LOGO_PATH = path.join(process.cwd(), "public", "mobo-icon.png");

/** Antetul Mobo pe documente — logo oficial. */
export function drawHeader(doc: PDFKit.PDFDocument, orgName: string, subtitle: string) {
  const y = doc.y;
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 50, y, { height: 34 });
  } else {
    doc.save();
    doc.rect(50, y, 34, 34).fill("#ccdf10");
    doc.restore();
  }
  doc
    .fillColor("#20211b")
    .font("bold")
    .fontSize(16)
    .text(orgName, 95, y + 2);
  doc.font("body").fontSize(9).fillColor("#666").text(subtitle, 95, y + 21);
  doc.moveDown(2);
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#ccdf10")
    .lineWidth(2)
    .stroke();
  doc.moveDown(1);
  doc.fillColor("#20211b");
}

/**
 * Subsolul pe TOATE paginile, desenat la final (documentul are bufferPages).
 * Se scrie cu `lineBreak: false`, altfel pdfkit deschide singur o pagină nouă când textul
 * ajunge sub marginea de jos — de aici venea pagina a doua goală de la estimări.
 */
export function drawFooter(doc: PDFKit.PDFDocument, text: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // subsolul stă SUB marginea de jos; fără margine, pdfkit nu mai „sare” pe o pagină nouă
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("body").fontSize(8).fillColor("#999");
    doc.text(text, 50, 806, { width: 400, lineBreak: false });
    doc.text(`${i - range.start + 1} / ${range.count}`, 445, 806, { width: 100, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.fillColor("#20211b");
}

export function fontsAvailable(): boolean {
  return fs.existsSync(path.join(FONT_DIR, "DejaVuSans.ttf"));
}
