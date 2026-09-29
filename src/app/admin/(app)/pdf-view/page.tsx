import { requireUser } from "@/lib/auth";
import { stat } from "fs/promises";
import path from "path";
import { PdfViewer } from "./PdfViewer";

export const metadata = { title: "Vizualizare PDF — MOBO CRM" };
export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

async function exists(name: string) {
  try {
    await stat(path.join(UPLOADS_DIR, name));
    return true;
  } catch {
    return false;
  }
}

export default async function PdfViewPage() {
  await requireUser();
  const availability = {
    "presentation-ro.pdf": await exists("presentation-ro.pdf"),
    "presentation-ru.pdf": await exists("presentation-ru.pdf"),
    "guide-ro.pdf": await exists("guide-ro.pdf"),
    "guide-ru.pdf": await exists("guide-ru.pdf"),
  };
  return <PdfViewer availability={availability} />;
}
