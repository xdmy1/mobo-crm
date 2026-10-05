// Depozitul de fișiere: PDF-uri, DOCX, PPTX, poze încărcate — totul stă în baza de date (StoredFile).
//
// De ce nu pe disc: pe Vercel fiecare cerere poate rula pe altă instanță, cu discul ei temporar.
// Oferta se scria la generare, iar descărcarea ajungea pe o instanță unde fișierul nu exista
// („Fișier inexistent”). Baza e singurul loc pe care îl văd toate instanțele.
// Fișierele scrise pe disc înainte de mutare (instalările locale) se citesc în continuare.

import path from "path";
import { readFile, stat } from "fs/promises";
import { prisma } from "./db";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

/** Calea pe disc a unui fișier vechi; null dacă cheia ar ieși din dosarul de upload. */
function legacyPath(key: string): string | null {
  const full = path.resolve(UPLOADS_DIR, key);
  return full.startsWith(UPLOADS_DIR + path.sep) ? full : null;
}

export async function putFile(key: string, data: Buffer, mime?: string | null): Promise<void> {
  const bytes = new Uint8Array(data);
  await prisma.storedFile.upsert({
    where: { key },
    create: { key, data: bytes, mime: mime ?? null, size: bytes.length },
    update: { data: bytes, mime: mime ?? null, size: bytes.length },
  });
}

export async function getFile(key: string): Promise<Buffer | null> {
  const row = await prisma.storedFile.findUnique({ where: { key }, select: { data: true } });
  if (row) return Buffer.from(row.data);
  const full = legacyPath(key);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

export async function hasFile(key: string): Promise<boolean> {
  if ((await prisma.storedFile.count({ where: { key } })) > 0) return true;
  const full = legacyPath(key);
  if (!full) return false;
  try {
    await stat(full);
    return true;
  } catch {
    return false;
  }
}
