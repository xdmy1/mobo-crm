import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Premiu — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="award"
      title="Premiu"
      createLabel="Creează Premiu"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "description", label: "Descriere", type: "textarea" },
      { name: "date", label: "Data", type: "date" },
    ]}
      searchParams={await searchParams}
    />
  );
}
