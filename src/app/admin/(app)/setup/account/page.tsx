import { guardFinancePage } from "@/components/finance/guard";
import { NomenclaturePage } from "@/components/setup/NomenclaturePage";
import type { ListParams } from "@/server/lists";

export const metadata = { title: "Lista de Account-uri — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  const { gate } = await guardFinancePage("readAll-account", "Lista de Account-uri");
  if (gate) return gate;
  return (
    <NomenclaturePage
      entity="account"
      title="Lista de Account-uri"
      createLabel="Adaugă Account"
      fields={[
      { name: "name", label: "Account", type: "text", required: true },
      { name: "type", label: "Tipul Account-ului", type: "select", required: true, options: [
        { value: "ASSET", label: "Asset" },
        { value: "LIABILITY", label: "Liability" },
        { value: "CAPITAL", label: "Capital" },
        { value: "WITHDRAWAL", label: "Withdrawal" },
        { value: "REVENUE", label: "Revenue" },
        { value: "EXPENSE", label: "Expense" },
      ] },
    ]}
      searchParams={await searchParams}
    />
  );
}
