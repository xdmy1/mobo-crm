import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import { getDocOptions } from "@/server/docOptions";
import { ListShell } from "@/components/table/ListShell";
import { OfferCreateButton } from "@/components/documents/ContractCreateButton";
import { PresentationCreateButton } from "@/components/documents/PresentationCreateButton";

export const metadata = { title: "Oferte — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, docOpts] = await Promise.all([
    getList("offer", params),
    getDocOptions(),
  ]);

  return (
    <ListShell
      entity="offer"
      title="Oferte"
      {...list}
      filters={[
        { key: "firstName", label: "Prenume", options: [], text: true },
        { key: "lastName", label: "Nume", options: [], text: true },
      ]}
      extraButtons={
        <>
          <PresentationCreateButton contacts={docOpts.contacts} />
          <OfferCreateButton variant="create" contacts={docOpts.contacts} rooms={docOpts.rooms} />
        </>
      }
    />
  );
}
