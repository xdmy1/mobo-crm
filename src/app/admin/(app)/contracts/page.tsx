import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import { getDocOptions } from "@/server/docOptions";
import { ListShell } from "@/components/table/ListShell";
import {
  ContractCreateButton,
  HandoverCreateButton,
} from "@/components/documents/ContractCreateButton";

export const metadata = { title: "Contracte — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, docOpts] = await Promise.all([
    getList("contract", params),
    getDocOptions(),
  ]);

  return (
    <ListShell
      entity="contract"
      title="Contracte"
      {...list}
      filters={[
        { key: "firstName", label: "Prenume", options: [], text: true },
        { key: "lastName", label: "Nume", options: [], text: true },
      ]}
      extraButtons={
        <>
          <HandoverCreateButton
            contacts={docOpts.contacts}
            rooms={docOpts.rooms}
            opportunities={docOpts.opportunities}
          />
          <ContractCreateButton
            variant="create"
            contacts={docOpts.contacts}
            companies={docOpts.companies}
            rooms={docOpts.rooms}
            opportunities={docOpts.opportunities}
          />
        </>
      }
    />
  );
}
