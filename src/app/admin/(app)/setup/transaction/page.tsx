import { guardFinancePage } from "@/components/finance/guard";
import { getList, type ListParams } from "@/server/lists";
import { accountOptions, contractOptions } from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Lista de tranzacții — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  const { gate } = await guardFinancePage("readAll-transaction", "Lista de tranzacții");
  if (gate) return gate;
  const params = await searchParams;
  const [list, accounts, contracts] = await Promise.all([
    getList("transaction", params),
    accountOptions(),
    contractOptions(),
  ]);

  const form: FormConfig = {
    title: "Adaugă Tranzacție",
    entity: "transaction",
    fields: [
      { name: "date", label: "Data", type: "date", required: true },
      { name: "debitAccountId", label: "Cont debit", type: "select", required: true, options: accounts },
      { name: "creditAccountId", label: "Cont credit", type: "select", required: true, options: accounts },
      { name: "amount", label: "Sumă (lei)", type: "number", required: true },
      { name: "description", label: "Descriere", type: "textarea" },
      { name: "contractId", label: "Contract (opțional)", type: "select", options: contracts },
    ],
  };

  return (
    <ListShell
      entity="transaction"
      title="Lista de tranzacții"
      {...list}
      createForm={form}
      createLabel="Adaugă Tranzacție"
      editForm={form}
    />
  );
}
