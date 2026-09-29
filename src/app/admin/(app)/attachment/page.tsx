import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  staffOptions,
  contactOptions,
  companyOptions,
  opportunityOptions,
  quoteOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Atașare — MOBO CRM" };
export const dynamic = "force-dynamic";

const TYPE_OPTIONS = [
  { value: "ATASAMENT", label: "Atașament" },
  { value: "PROIECT2D", label: "Proiect2D" },
  { value: "PROIECT3D", label: "Proiect3D" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OFERTA", label: "Ofertă" },
  { value: "MASURARI", label: "Măsurări" },
];

export default async function AttachmentsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, staff, contacts, companies, opportunities, quotes] =
    await Promise.all([
      getList("attachment", params),
      staffOptions(),
      contactOptions(),
      companyOptions(),
      opportunityOptions(),
      quoteOptions(),
    ]);

  const form: FormConfig = {
    title: "Creează Atașament",
    entity: "attachment",
    fields: [
      {
        name: "files",
        label: "Atașare",
        type: "file",
        required: true,
        help: "Poți încărca mai multe fișiere odată",
      },
      {
        name: "reportToId",
        label: "Raportează managerului",
        type: "select",
        required: true,
        options: staff,
        help: "Persoana care primește notificarea",
      },
      {
        name: "type",
        label: "Tipul atașamentului",
        type: "select",
        required: true,
        defaultValue: "ATASAMENT",
        options: TYPE_OPTIONS,
      },
      { name: "contactId", label: "Client", type: "select", options: contacts },
      { name: "companyId", label: "Persoană juridică", type: "select", options: companies },
      { name: "opportunityId", label: "Proiect", type: "select", options: opportunities },
      { name: "quoteId", label: "Estimare", type: "select", options: quotes },
      { name: "name", label: "Nume (opțional)", type: "text" },
    ],
  };

  return (
    <ListShell
      entity="attachment"
      title="Atașamente"
      {...list}
      filters={[
        { key: "type", label: "Tipul atașamentului", options: TYPE_OPTIONS },
        { key: "contact", label: "Client", options: contacts },
        { key: "company", label: "Persoană juridică", options: companies },
        { key: "opportunity", label: "Proiect", options: opportunities },
        { key: "quote", label: "Estimare", options: quotes },
      ]}
      createForm={form}
      createLabel="Creează Atașament"
    />
  );
}
