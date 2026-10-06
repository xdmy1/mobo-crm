import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Sursă Client — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="contactSource"
      title="Sursă Client"
      createLabel="Creează Sursă"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "code", label: "Cod ID (2 cifre)", type: "text", required: true, placeholder: "01", help: "Primele 2 cifre din ID-ul uman al clientului" },
      { name: "order", label: "Ordine", type: "number", placeholder: "la final", help: "Poziția în lista de surse (1 = prima)" },
    ]}
      searchParams={await searchParams}
    />
  );
}
