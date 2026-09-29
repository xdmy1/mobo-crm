import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Proiectant / Designer — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="designerPartner"
      title="Proiectant / Designer"
      createLabel="Creează Designer"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "phone", label: "Telefon", type: "text" },
      { name: "commissionPercent", label: "Comision (%)", type: "number" },
    ]}
      searchParams={await searchParams}
    />
  );
}
