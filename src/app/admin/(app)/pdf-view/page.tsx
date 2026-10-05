import { requireUser } from "@/lib/auth";
import { hasFile } from "@/lib/storage";
import { PdfViewer } from "./PdfViewer";

export const metadata = { title: "Vizualizare PDF — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function PdfViewPage() {
  await requireUser();
  const availability = {
    "presentation-ro.pdf": await hasFile("presentation-ro.pdf"),
    "presentation-ru.pdf": await hasFile("presentation-ru.pdf"),
    "guide-ro.pdf": await hasFile("guide-ro.pdf"),
    "guide-ru.pdf": await hasFile("guide-ru.pdf"),
  };
  return <PdfViewer availability={availability} />;
}
