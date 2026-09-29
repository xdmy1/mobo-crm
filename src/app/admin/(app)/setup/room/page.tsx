import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Camere (nomenclator) — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="roomType"
      title="Camere (nomenclator)"
      createLabel="Creează Cameră"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "elements", label: "Elemente", type: "tags", help: "Piesele de mobilier tipice pentru această cameră" },
    ]}
      searchParams={await searchParams}
    />
  );
}
