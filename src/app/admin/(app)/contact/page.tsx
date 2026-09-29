import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  contactSourceOptions,
  contactStageOptions,
  companyOptions,
  staffOptions,
} from "@/server/options";
import { getDocOptions } from "@/server/docOptions";
import { ListShell } from "@/components/table/ListShell";
import { ContractCreateButton } from "@/components/documents/ContractCreateButton";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Persoane Fizice — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [list, stages, sources, companies, staff, docOpts] = await Promise.all([
    getList("contact", params),
    contactStageOptions(),
    contactSourceOptions(),
    companyOptions(),
    staffOptions(),
    getDocOptions(),
  ]);

  const createForm: FormConfig = {
    title: "Creează Client",
    entity: "contact",
    smartPaste: true,
    dedupePhoneField: "phone",
    fields: [
      { name: "firstName", label: "Prenume", type: "text", required: true, placeholder: "Ion" },
      { name: "lastName", label: "Nume", type: "text", required: true, placeholder: "Popescu" },
      { name: "phone", label: "Număr de contact", type: "text", placeholder: "+373 69 000 000" },
      { name: "email", label: "Email", type: "email" },
      // precompletate: cine creează clientul e de regulă și responsabilul lui, iar un client nou e „Lead”
      {
        name: "staffId",
        label: "Responsabilul contactului",
        type: "select",
        options: staff,
        defaultValue: String(user.id),
      },
      {
        name: "stageId",
        label: "Etapa",
        type: "select",
        options: stages,
        defaultValue: stages.find((s) => s.label === "Lead")?.value,
      },
      { name: "sourceId", label: "Sursă", type: "select", options: sources },
      { name: "companyId", label: "Persoană juridică", type: "select", options: companies },
    ],
  };

  return (
    <ListShell
      entity="contact"
      title="Persoane Fizice"
      {...list}
      softDelete
      filters={[
        { key: "stage", label: "Etapa", options: stages },
        { key: "source", label: "Sursă", options: sources },
        { key: "staff", label: "Responsabil", options: staff },
        { key: "company", label: "Persoană juridică", options: companies },
      ]}
      createForm={createForm}
      createLabel="Creează Client"
      detailBase="/admin/contact"
      extraButtons={
        <ContractCreateButton
          contacts={docOpts.contacts}
          companies={docOpts.companies}
          rooms={docOpts.rooms}
          opportunities={docOpts.opportunities}
        />
      }
    />
  );
}
