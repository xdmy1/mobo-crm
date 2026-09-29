import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  staffOptions,
  contactOptions,
  opportunityStageOptions,
  opportunityTypeOptions,
  opportunitySourceOptions,
  roomOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Proiecte — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, staff, contacts, stages, types, sources, rooms] =
    await Promise.all([
      getList("opportunity", params),
      staffOptions(),
      contactOptions(),
      opportunityStageOptions(),
      opportunityTypeOptions(),
      opportunitySourceOptions(),
      roomOptions(),
    ]);

  const form: FormConfig = {
    title: "Creează Proiect",
    entity: "opportunity",
    fields: [
      { name: "name", label: "Nume", type: "text", required: true, help: "Denumirea proiectului" },
      { name: "roomId", label: "Nume cameră", type: "select", required: true, options: rooms },
      { name: "staffId", label: "Responsabil de proiect", type: "select", options: staff },
      { name: "startDate", label: "Data de creare a proiectului", type: "date" },
      { name: "closeDate", label: "Deadline", type: "date" },
      { name: "contactId", label: "Client", type: "select", options: contacts },
      { name: "description", label: "Descriere", type: "textarea", placeholder: "Descrieți despre…" },
    ],
  };

  return (
    <ListShell
      entity="opportunity"
      title="Proiecte"
      {...list}
      softDelete
      filters={[
        { key: "stage", label: "Etapa", options: stages },
        { key: "contact", label: "Client", options: contacts },
        { key: "staff", label: "Responsabil", options: staff },
        { key: "type", label: "Tip", options: types },
        { key: "source", label: "Sursă", options: sources },
      ]}
      createForm={form}
      createLabel="Creează Proiect"
    />
  );
}
