import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Etapa de Proiectare (Producție) — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="opportunityStage"
      title="Etapa de Proiectare (Producție)"
      createLabel="Creează Etapă"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "order", label: "Ordine", type: "number" },
      { name: "phase", label: "Fază", type: "select", options: [
        { value: "producție", label: "Producție" },
        { value: "logistică", label: "Logistică" },
        { value: "post-vânzare", label: "Post-vânzare" },
      ] },
    ]}
      searchParams={await searchParams}
    />
  );
}
