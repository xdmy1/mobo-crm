import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getCurrentUser, can } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");
const SLOTS = new Set([
  "presentation-ro.pdf",
  "presentation-ru.pdf",
  "guide-ro.pdf",
  "guide-ru.pdf",
]);

/** Upload PDF Prezentare/Ghid (Setup → Organizație) [NOU]. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "update-organization"))
    return NextResponse.json({ error: "Fără permisiune" }, { status: 403 });

  const formData = await req.formData();
  const slot = String(formData.get("slot") ?? "");
  const file = formData.get("file");
  if (!SLOTS.has(slot) || !(file instanceof File))
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, slot), buf);
  return NextResponse.json({ ok: true });
}
