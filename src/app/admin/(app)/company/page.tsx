import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import { companyTypeOptions, industryOptions } from "@/server/options";
import { getDocOptions } from "@/server/docOptions";
import { ListShell } from "@/components/table/ListShell";
import { ContractCreateButton } from "@/components/documents/ContractCreateButton";
import { companyFormConfig } from "@/lib/forms/company";

export const metadata = { title: "Persoane Juridice — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, types, industries, docOpts] = await Promise.all([
    getList("company", params),
    companyTypeOptions(),
    industryOptions(),
    getDocOptions(),
  ]);

  const form = companyFormConfig(types, industries);

  return (
    <ListShell
      entity="company"
      title="Persoane Juridice"
      {...list}
      createForm={form}
      createLabel="Creează Pers. Juridică"
      detailBase="/admin/company"
      editForm={form}
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
