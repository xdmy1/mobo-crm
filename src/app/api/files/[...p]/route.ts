import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ p: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const { p } = await ctx.params;
  const rel = decodeURIComponent(p.join("/"));
  const full = path.resolve(UPLOADS_DIR, rel);
  if (!full.startsWith(UPLOADS_DIR))
    return NextResponse.json({ error: "Cale invalidă" }, { status: 400 });

  try {
    await stat(full);
    const buf = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    const displayName = rel.includes("__") ? rel.split("__").slice(1).join("__") : rel;
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(displayName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fișier inexistent" }, { status: 404 });
  }
}
