import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Lista de Proiecte (Sursă) — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="opportunitySource"
      title="Lista de Proiecte (Sursă)"
      createLabel="Creează Sursă Proiect"
      searchParams={await searchParams}
    />
  );
}
