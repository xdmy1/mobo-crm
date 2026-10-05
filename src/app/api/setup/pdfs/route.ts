import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth";
import { putFile } from "@/lib/storage";

export const runtime = "nodejs";

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
  await putFile(slot, buf, "application/pdf");
  return NextResponse.json({ ok: true });
}
