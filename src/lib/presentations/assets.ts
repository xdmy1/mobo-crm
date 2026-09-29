// Pregătirea fotografiilor pentru prezentare (sharp): decupare „cover” la proporția casetei,
// rezoluție rezonabilă (fișiere mici), voal grafit pentru text lizibil și colțuri rotunjite.
// Aceeași imagine pregătită intră și în PPTX, și în PDF — deci arată identic.

import fs from "fs";
import sharp, { type OverlayOptions } from "sharp";
import { BRAND } from "./data";
import type { Scrim } from "./scene";

const PX_PER_IN = 170;
const MAX_W = 2600;

export interface PreparedImage {
  data: Buffer;
  mime: "image/jpeg" | "image/png";
}

const cache = new Map<string, Promise<PreparedImage | null>>();

const hex = (c: string) => `#${c}`;

function scrimSvg(w: number, h: number, kind: Scrim): string {
  const ink = hex(BRAND.ink);
  const stops: Record<Scrim, string> = {
    // text în stânga, fotografia „respiră” în dreapta
    left: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ink}" stop-opacity="0.94"/>
        <stop offset="0.42" stop-color="${ink}" stop-opacity="0.78"/>
        <stop offset="0.78" stop-color="${ink}" stop-opacity="0.18"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.05"/></linearGradient>`,
    leftStrong: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ink}" stop-opacity="0.96"/>
        <stop offset="0.5" stop-color="${ink}" stop-opacity="0.8"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.3"/></linearGradient>`,
    // coperta: text în stânga + benzi discrete sus și jos, ca rândurile mici să rămână lizibile pe orice fotografie
    cover: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ink}" stop-opacity="0.95"/>
        <stop offset="0.4" stop-color="${ink}" stop-opacity="0.8"/>
        <stop offset="0.75" stop-color="${ink}" stop-opacity="0.22"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.1"/></linearGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ink}" stop-opacity="0.55"/>
        <stop offset="0.22" stop-color="${ink}" stop-opacity="0"/>
        <stop offset="0.74" stop-color="${ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.8"/></linearGradient>`,
    // fotografie de galerie: doar o umbră jos, pentru eticheta albă
    caption: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.6" stop-color="${ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.7"/></linearGradient>`,
    bottom: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.35" stop-color="${ink}" stop-opacity="0"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.82"/></linearGradient>`,
    full: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ink}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${ink}" stop-opacity="0.55"/></linearGradient>`,
  };
  const second = stops[kind].includes('id="g2"') ? `<rect width="${w}" height="${h}" fill="url(#g2)"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${stops[kind]}</defs><rect width="${w}" height="${h}" fill="url(#g)"/>${second}</svg>`;
}

/** colțurile din afara dreptunghiului rotunjit, umplute cu fundalul slide-ului (JPEG rămâne mic, fără alfa) */
function cornersSvg(w: number, h: number, r: number, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill="${hex(bg)}" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z"/></svg>`;
}

/** pictogramă SVG → PNG transparent, la rezoluția casetei (rămâne clară și pe proiector) */
export async function rasterizeSvg(svg: string, wIn: number, hIn: number): Promise<PreparedImage> {
  const w = Math.max(24, Math.round(wIn * 300));
  const h = Math.max(24, Math.round(hIn * 300));
  const data = await sharp(Buffer.from(svg), { density: 600 })
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return { data, mime: "image/png" };
}

export function prepareImage(
  src: string,
  wIn: number,
  hIn: number,
  opts: { radius?: number; bg?: string; scrim?: Scrim; fit?: "cover" | "contain" } = {}
): Promise<PreparedImage | null> {
  const key = [src, wIn.toFixed(3), hIn.toFixed(3), opts.radius ?? 0, opts.bg ?? "", opts.scrim ?? "", opts.fit ?? ""].join("|");
  let job = cache.get(key);
  if (!job) {
    job = build(src, wIn, hIn, opts).catch(() => null);
    cache.set(key, job);
    // cache-ul ține doar cât o generare; memoria nu crește de la o prezentare la alta
    setTimeout(() => cache.delete(key), 60_000).unref?.();
  }
  return job;
}

async function build(
  src: string,
  wIn: number,
  hIn: number,
  opts: { radius?: number; bg?: string; scrim?: Scrim; fit?: "cover" | "contain" }
): Promise<PreparedImage | null> {
  if (!fs.existsSync(src)) return null;

  // logo-uri / PNG-uri cu transparență: trec neschimbate
  if (opts.fit === "contain") return { data: await fs.promises.readFile(src), mime: "image/png" };

  const scale = Math.min(PX_PER_IN, MAX_W / wIn);
  const w = Math.max(16, Math.round(wIn * scale));
  const h = Math.max(16, Math.round(hIn * scale));

  const overlays: OverlayOptions[] = [];
  if (opts.scrim) overlays.push({ input: Buffer.from(scrimSvg(w, h, opts.scrim)) });
  if (opts.radius && opts.bg)
    overlays.push({ input: Buffer.from(cornersSvg(w, h, Math.round(opts.radius * scale), opts.bg)) });

  let img = sharp(src).rotate().resize(w, h, { fit: "cover", position: "centre" });
  if (overlays.length) img = img.composite(overlays);
  const data = await img.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return { data, mime: "image/jpeg" };
}
