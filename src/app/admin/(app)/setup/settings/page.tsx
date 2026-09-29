import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { fmtDateTime } from "@/lib/format";
import { CatalogEditor } from "./CatalogEditor";

export const metadata = { title: "Setări de Calcule — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function CalcSettingsPage() {
  await requireUser();
  const [catalog, history] = await Promise.all([
    getActiveCatalog(),
    prisma.calcCatalog.findMany({
      orderBy: { validFrom: "desc" },
      take: 10,
      select: { id: true, active: true, validFrom: true },
    }),
  ]);

  return (
    <CatalogEditor
      catalog={catalog}
      history={history.map((h) => ({
        id: h.id,
        active: h.active,
        validFrom: fmtDateTime(h.validFrom),
      }))}
    />
  );
}
