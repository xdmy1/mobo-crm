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

export const metadata = { title: "Mesaje — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, staff, contacts, companies, opportunities, quotes] =
    await Promise.all([
      getList("note", params),
      staffOptions(),
      contactOptions(),
      companyOptions(),
      opportunityOptions(),
      quoteOptions(),
    ]);

  const form: FormConfig = {
    title: "Creează Mesaj",
    entity: "note",
    fields: [
      { name: "title", label: "Titlu", type: "text", required: true },
      {
        name: "recipientId",
        label: "Destinatarul notiței",
        type: "select",
        required: true,
        options: staff,
        help: "Utilizatorul care primește notificarea",
      },
      { name: "contactId", label: "Client", type: "select", options: contacts },
      { name: "companyId", label: "Persoană juridică", type: "select", options: companies },
      { name: "opportunityId", label: "Proiect", type: "select", options: opportunities },
      { name: "quoteId", label: "Estimare", type: "select", options: quotes },
      { name: "body", label: "Mesaj", type: "textarea" },
    ],
  };

  return (
    <ListShell
      entity="note"
      title="Mesaje"
      {...list}
      filters={[
        { key: "contact", label: "Client", options: contacts },
        { key: "company", label: "Persoană juridică", options: companies },
        { key: "opportunity", label: "Proiect", options: opportunities },
        { key: "quote", label: "Estimare", options: quotes },
      ]}
      createForm={form}
      createLabel="Creează Mesaj"
      editForm={form}
    />
  );
}
