import { prisma } from "@/lib/db";
import { guardFinancePage } from "@/components/finance/guard";
import { EMPTY } from "@/lib/format";
import { contactLabel } from "@/lib/people";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { FinancesTable, type FinanceRow } from "./FinancesTable";

export const metadata = { title: "Bord Finanțe — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const { gate } = await guardFinancePage("readAll-finances", "Bord Finanțe");
  if (gate) return gate;

  const [contracts, org, catalog] = await Promise.all([
    prisma.contract.findMany({
      // procesele-verbale și contractele anulate nu sunt bani
      where: { kind: { not: "HANDOVER" }, status: { not: "ANULAT" }, OR: [{ contactId: null }, { contact: { deletedAt: null } }] },
      orderBy: { number: "desc" },
      include: {
        contact: true,
        company: true,
        finance: true,
        payments: { orderBy: { date: "desc" } },
      },
    }),
    prisma.organization.findUnique({ where: { id: 1 } }),
    getActiveCatalog(),
  ]);

  const rows: FinanceRow[] = contracts.map((c) => {
    const f = c.finance;
    return {
      contractId: c.id,
      number: c.number,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      clientLabel: c.contact ? contactLabel(c.contact) : c.company?.name ?? EMPTY,
      clientHref: c.contact
        ? `/admin/contact/${c.contact.id}`
        : c.company
          ? `/admin/company/${c.company.id}`
          : null,
      sinecost: f?.sinecost ?? 0,
      prodPrice: f?.prodPrice ?? 0,
      contractSumEur: f?.contractSumEur ?? c.retribution ?? 0,
      avans1: f?.avans1 ?? 0,
      avans2: f?.avans2 ?? 0,
      avans3: f?.avans3 ?? 0,
      avansProducere: f?.avansProducere ?? 0,
      transaFinalaProducere: f?.transaFinalaProducere ?? 0,
      procentQc: f?.procentQc ?? org?.qcDefault ?? 1200,
      cadou: f?.cadou ?? 0,
      reducere: f?.reducere ?? 0,
      payments: c.payments.map((p) => ({
        id: p.id,
        date: p.date.toISOString(),
        amountEur: p.amountEur,
        method: p.method,
        note: p.note,
      })),
    };
  });

  return (
    <FinancesTable
      rows={rows}
      partnerPercent={org?.partnerPercent ?? 10}
      designerPercent={org?.designerPercent ?? 5}
      cursEuro={catalog.cursEuro}
    />
  );
}
