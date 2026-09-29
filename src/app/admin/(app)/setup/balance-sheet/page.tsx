import { guardFinancePage } from "@/components/finance/guard";
import { accountBalances } from "@/lib/accounting";
import { parseRange, ReportTable } from "@/components/setup/ReportShell";

export const metadata = { title: "Bilanț — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { gate } = await guardFinancePage("readAll-transaction", "Bilanț");
  if (gate) return gate;
  const sp = await searchParams;
  const { from, to } = parseRange(sp);
  const balances = await accountBalances(from, to);

  const assets = balances.filter((b) => b.type === "ASSET");
  const liabilities = balances.filter((b) => b.type === "LIABILITY");
  const capital = balances.filter(
    (b) => b.type === "CAPITAL" || b.type === "WITHDRAWAL"
  );
  const revenue = balances
    .filter((b) => b.type === "REVENUE")
    .reduce((s, b) => s + b.balance, 0);
  const expense = balances
    .filter((b) => b.type === "EXPENSE")
    .reduce((s, b) => s + b.balance, 0);
  const netIncome = revenue - expense;

  const totalAssets = assets.reduce((s, b) => s + b.balance, 0);
  const totalLiab =
    liabilities.reduce((s, b) => s + b.balance, 0) +
    capital.reduce((s, b) => s + (b.type === "WITHDRAWAL" ? -b.balance : b.balance), 0) +
    netIncome;

  const rows: Array<Array<string | number>> = [
    ["ACTIVE", ""],
    ...assets.map((b): Array<string | number> => [`  ${b.name}`, b.balance]),
    ["TOTAL ACTIVE", totalAssets],
    ["", ""],
    ["PASIVE ȘI CAPITAL", ""],
    ...liabilities.map((b): Array<string | number> => [`  ${b.name}`, b.balance]),
    ...capital.map((b): Array<string | number> => [
      `  ${b.name}`,
      b.type === "WITHDRAWAL" ? -b.balance : b.balance,
    ]),
    ["  Profit net (Adeverință de venit)", netIncome],
  ];

  return (
    <ReportTable
      title="Bilanț"
      head={["Poziție", "Sold"]}
      rows={rows}
      totals={["TOTAL PASIVE + CAPITAL", totalLiab]}
      range={{ from: sp.from, to: sp.to }}
    />
  );
}
