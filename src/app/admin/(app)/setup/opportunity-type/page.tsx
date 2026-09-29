import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Tipul Proiectului — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="opportunityType"
      title="Tipul Proiectului"
      createLabel="Creează Tip Proiect"
      searchParams={await searchParams}
    />
  );
}
