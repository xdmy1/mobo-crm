import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Anunț — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="announcement"
      title="Anunț"
      createLabel="Creează Anunț"
      fields={[
      { name: "title", label: "Titlu", type: "text", required: true },
      { name: "body", label: "Anunț", type: "textarea" },
      { name: "date", label: "Data", type: "date" },
    ]}
      searchParams={await searchParams}
    />
  );
}
