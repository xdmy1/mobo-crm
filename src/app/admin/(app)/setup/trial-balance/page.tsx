import { guardFinancePage } from "@/components/finance/guard";
import { accountBalances } from "@/lib/accounting";
import { parseRange, ReportTable } from "@/components/setup/ReportShell";

export const metadata = { title: "Balanță de Probă — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { gate } = await guardFinancePage("readAll-transaction", "Balanță de Probă");
  if (gate) return gate;
  const sp = await searchParams;
  const { from, to } = parseRange(sp);
  const balances = await accountBalances(from, to);
  const active = balances.filter((b) => b.debit !== 0 || b.credit !== 0);
  const totalDebit = active.reduce((s, b) => s + b.debit, 0);
  const totalCredit = active.reduce((s, b) => s + b.credit, 0);

  return (
    <ReportTable
      title="Balanță de Probă"
      head={["Cont", "Debit", "Credit"]}
      rows={active.map((b) => [b.name, b.debit, b.credit])}
      totals={["TOTAL", totalDebit, totalCredit]}
      range={{ from: sp.from, to: sp.to }}
    />
  );
}
