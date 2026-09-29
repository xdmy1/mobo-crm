import { guardFinancePage } from "@/components/finance/guard";
import { accountBalances } from "@/lib/accounting";
import { parseRange, ReportTable } from "@/components/setup/ReportShell";

export const metadata = { title: "Adeverință de Venit — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { gate } = await guardFinancePage("readAll-transaction", "Adeverință de Venit");
  if (gate) return gate;
  const sp = await searchParams;
  const { from, to } = parseRange(sp);
  const balances = await accountBalances(from, to);

  const revenues = balances.filter((b) => b.type === "REVENUE" && b.balance !== 0);
  const expenses = balances.filter((b) => b.type === "EXPENSE" && b.balance !== 0);
  const totalRevenue = revenues.reduce((s, b) => s + b.balance, 0);
  const totalExpense = expenses.reduce((s, b) => s + b.balance, 0);

  const rows: Array<Array<string | number>> = [
    ["VENITURI", ""],
    ...revenues.map((b): Array<string | number> => [`  ${b.name}`, b.balance]),
    ["Total venituri", totalRevenue],
    ["", ""],
    ["CHELTUIELI", ""],
    ...expenses.map((b): Array<string | number> => [`  ${b.name}`, b.balance]),
    ["Total cheltuieli", totalExpense],
  ];

  return (
    <ReportTable
      title="Adeverință de Venit"
      head={["Poziție", "Sumă"]}
      rows={rows}
      totals={["PROFIT NET", totalRevenue - totalExpense]}
      range={{ from: sp.from, to: sp.to }}
    />
  );
}
