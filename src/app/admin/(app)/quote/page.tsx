import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import {
  contactOptions,
  companyOptions,
  opportunityOptions,
  quoteStageOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import { QuoteCreateButton } from "./QuoteCreateButton";

export const metadata = { title: "Estimări — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, stages, contacts, companies, opportunities, catalog] =
    await Promise.all([
      getList("quote", params),
      quoteStageOptions(),
      contactOptions(),
      companyOptions(),
      opportunityOptions(),
      getActiveCatalog(),
    ]);

  return (
    <ListShell
      entity="quote"
      title="Estimări"
      {...list}
      softDelete
      filters={[
        { key: "stage", label: "Selectează etapa", options: stages },
        { key: "contact", label: "Selectează clientul", options: contacts },
        { key: "company", label: "Selectează persoana juridică", options: companies },
        { key: "opportunity", label: "Selectează proiectul", options: opportunities },
        {
          key: "active",
          label: "Stare",
          options: [
            { value: "true", label: "Activă" },
            { value: "false", label: "Inactivă" },
          ],
        },
      ]}
      extraButtons={
        <QuoteCreateButton opportunities={opportunities} catalog={catalog} />
      }
    />
  );
}
