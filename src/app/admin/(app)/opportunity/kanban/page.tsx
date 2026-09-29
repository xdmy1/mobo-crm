import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtDate, fmtLei, daysBetween, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { countedQuotes, sumQuotes } from "@/lib/sums";
import { opportunityStageColor } from "@/lib/status";
import { KanbanBoard, type KanbanCard } from "@/components/kanban/KanbanBoard";

export const metadata = { title: "Bord Producere — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function ProductionKanbanPage() {
  await requireUser();
  const [stages, opportunities] = await Promise.all([
    prisma.opportunityStage.findMany({ orderBy: { order: "asc" } }),
    prisma.opportunity.findMany({
      // proiectele unui client șters nu rămân pe bord
      where: {
        deletedAt: null,
        stageId: { not: null },
        onProductionBoard: true,
        OR: [{ contactId: null }, { contact: { deletedAt: null } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        contact: true,
        staff: true,
        quotes: true,
      },
    }),
  ]);

  const now = new Date();
  const cards: KanbanCard[] = opportunities.map((o) => {
    // aceeași valoare ca în lista de proiecte și în fișă: doar estimările active
    const sum = sumQuotes(countedQuotes(o.quotes)).lei;
    return {
      id: o.id,
      columnId: o.stageId!,
      title: o.contact ? personName(o.contact) : o.name,
      humanId: o.contact?.humanId,
      datetime: fmtDateTime(o.createdAt),
      sum: sum > 0 ? fmtLei(sum) : undefined,
      amount: sum,
      projectName: o.name,
      deliveryText: `Data livrării: ${o.deliveryDate ? fmtDate(o.deliveryDate) : EMPTY}`,
      href: `/admin/opportunity/${o.id}`,
      staffName: o.staff ? personName(o.staff) : undefined,
      daysInStage: daysBetween(o.stageEnteredAt, now),
    };
  });

  return (
    <KanbanBoard
      board="production"
      columns={stages.map((s) => ({
        id: s.id,
        name: s.name,
        danger: s.name === "Asistență Juridică",
        color: opportunityStageColor(s.name),
      }))}
      cards={cards}
    />
  );
}
