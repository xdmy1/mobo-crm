import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, daysBetween } from "@/lib/format";
import { personName } from "@/lib/people";
import { contactStageColor } from "@/lib/status";
import { staffOptions, failureCauseOptions } from "@/server/options";
import { KanbanBoard, type KanbanCard } from "@/components/kanban/KanbanBoard";

export const metadata = { title: "Bord Vânzări — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function SalesKanbanPage() {
  await requireUser();
  const [stages, contacts, staff, causes, companies] = await Promise.all([
    prisma.contactStage.findMany({ orderBy: { order: "asc" } }),
    prisma.contact.findMany({
      where: { deletedAt: null, stageId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { staff: true },
    }),
    staffOptions(),
    failureCauseOptions(),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const now = new Date();
  const cards: KanbanCard[] = contacts.map((c) => ({
    id: c.id,
    columnId: c.stageId!,
    title: personName(c),
    humanId: c.humanId,
    datetime: fmtDateTime(c.createdAt),
    phone: c.phone ?? undefined,
    href: `/admin/contact/${c.id}`,
    staffName: c.staff ? personName(c.staff) : undefined,
    daysInStage: daysBetween(c.stageEnteredAt, now),
  }));

  const leadStage = stages.find((s) => s.name === "Lead");

  return (
    <KanbanBoard
      board="sales"
      columns={stages.map((s) => ({
        id: s.id,
        name: s.name,
        danger: s.requireFailureCause,
        color: contactStageColor(s.name),
      }))}
      cards={cards}
      staffOptions={staff}
      failureCauses={causes}
      leadStageId={leadStage?.id}
      companyNames={companies.map((c) => c.name)}
    />
  );
}
