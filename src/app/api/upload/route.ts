import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { putFile } from "@/lib/storage";

export const runtime = "nodejs";

// păstrează diacriticele corect (UTF-8), elimină doar caracterele periculoase [NOU]
function safeName(name: string): string {
  return name.replace(/[/\\:*?"<>|\x00-\x1f]/g, "_").slice(0, 180);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length)
    return NextResponse.json({ error: "Niciun fișier" }, { status: 400 });

  const out = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 50 * 1024 * 1024)
      return NextResponse.json({ error: "Fișier prea mare (max 50MB)" }, { status: 400 });
    const id = crypto.randomUUID();
    const name = safeName(file.name || "fisier");
    const stored = `${id}__${name}`;
    await putFile(stored, buf, file.type || null);
    out.push({
      path: stored,
      name,
      mime: file.type || "application/octet-stream",
      size: buf.length,
    });
  }
  return NextResponse.json(out);
}
