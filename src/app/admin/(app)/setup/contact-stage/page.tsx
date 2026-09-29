import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Etape Client (Vânzări) — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="contactStage"
      title="Etape Client (Vânzări)"
      createLabel="Creează Etapă"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "order", label: "Ordine", type: "number" },
      { name: "requireContract", label: "Cere contract la intrare", type: "checkbox" },
      { name: "require2D", label: "Cere Proiect2D la intrare", type: "checkbox" },
      { name: "require3D", label: "Cere Proiect3D la intrare", type: "checkbox" },
      { name: "requireFailureCause", label: "Cere cauza eșecului", type: "checkbox" },
      { name: "notifyOnEnter", label: "Notifică responsabilul la intrare", type: "checkbox" },
    ]}
      searchParams={await searchParams}
    />
  );
}
