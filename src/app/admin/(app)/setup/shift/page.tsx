import { requireUser } from "@/lib/auth";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Schimburi (ture) — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  return (
    <NomenclaturePage
      entity="shift"
      title="Schimburi (ture)"
      createLabel="Creează Schimb"
      fields={[
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "startTime", label: "Ora de început", type: "text", placeholder: "08:00" },
      { name: "endTime", label: "Ora de sfârșit", type: "text", placeholder: "17:00" },
    ]}
      searchParams={await searchParams}
    />
  );
}
