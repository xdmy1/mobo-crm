import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  contactOptions,
  companyOptions,
  opportunityOptions,
  quoteOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import { EmailCreateButton } from "./EmailCreateButton";

export const metadata = { title: "Email — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, contacts, companies, opportunities, quotes] = await Promise.all([
    getList("email", params),
    contactOptions(),
    companyOptions(),
    opportunityOptions(),
    quoteOptions(),
  ]);

  return (
    <ListShell
      entity="email"
      title="Email"
      {...list}
      filters={[
        { key: "contact", label: "Client", options: contacts },
        { key: "company", label: "Persoană juridică", options: companies },
      ]}
      extraButtons={
        <EmailCreateButton
          contacts={contacts}
          companies={companies}
          opportunities={opportunities}
          quotes={quotes}
        />
      }
    />
  );
}
