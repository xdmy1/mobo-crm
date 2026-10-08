import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Calculator, QrCode, Truck, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { daysBetween, fmtDate, fmtDateTime, fmtEur, fmtLei, ymdChisinau, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { countedQuotes, sumQuotes } from "@/lib/sums";
import { taskPriority, taskStatus } from "@/lib/status";
import { SetCrumb } from "@/components/layout/Crumb";
import { StagePath } from "@/components/workflow/StagePath";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import {
  staffOptions,
  opportunityStageOptions,
  opportunityTypeOptions,
  opportunitySourceOptions,
  productionSequenceOptions,
  taskTypeOptions,
  taskStatusOptions,
  taskPriorityOptions,
} from "@/server/options";
import { PageHeader, StatCard } from "@/components/layout/PageHeader";
import { OpportunityPanels } from "./OpportunityPanels";
import { noteReadCell } from "@/lib/messages";
import type { PanelRow } from "../../contact/[id]/ContactPanels";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const oppId = parseInt(id, 10);
  if (isNaN(oppId)) notFound();

  const opp = await prisma.opportunity.findFirst({
    where: { id: oppId, deletedAt: null },
    include: {
      contact: true,
      staff: true,
      room: true,
      stage: true,
      type: true,
      source: true,
      productionSequence: true,
      quotes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: true, type: true, status: true, priority: true,
          _count: { select: { notes: true } },
        },
      },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true, recipient: true } },
      stageHistory: { select: { stageId: true } },
      attachments: { orderBy: { createdAt: "desc" }, include: { staff: true } },
    },
  });
  if (!opp) notFound();

  const [staff, stages, types, sources, prodSeq, taskTypes, taskStatuses, taskPriorities, catalog, stageRows] =
    await Promise.all([
      staffOptions(),
      opportunityStageOptions(),
      opportunityTypeOptions(),
      opportunitySourceOptions(),
      productionSequenceOptions(),
      taskTypeOptions(),
      taskStatusOptions(),
      taskPriorityOptions(),
      getActiveCatalog(),
      prisma.opportunityStage.findMany({ orderBy: { order: "asc" } }),
    ]);

  // valoarea proiectului — aceeași regulă ca în liste, pe bord și în fișa clientului
  const value = sumQuotes(countedQuotes(opp.quotes));
  const activeQuotes = countedQuotes(opp.quotes).length;
  const deadlineDays = opp.closeDate
    ? Math.round((new Date(ymdChisinau(opp.closeDate)).getTime() - new Date(ymdChisinau()).getTime()) / 86400000)
    : null;

  const quoteRows: PanelRow[] = opp.quotes.map((q) => ({
    id: q.id,
    cells: [
      { text: q.name, href: `/admin/quote/${q.id}` },
      { text: fmtDate(q.quoteDate) },
      { text: fmtDate(q.expirationDate) },
      { text: fmtDateTime(q.createdAt) },
    ],
  }));

  // fișierele proiectului, pe grupele din panoul „Fișiere”: 2D, 3D, Specificații, restul
  const attachRows = (keep: (type: string) => boolean): PanelRow[] =>
    opp.attachments
      .filter((a) => keep(a.type))
      .map((a) => ({
        id: a.id,
        cells: [
          { text: a.name },
          { text: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "—" },
          { text: fmtDateTime(a.createdAt) },
        ],
        downloadHref: `/api/files/${encodeURIComponent(a.filePath)}?download=1`,
      }));
  const attach2D = attachRows((t) => t === "PROIECT2D");
  const attach3D = attachRows((t) => t === "PROIECT3D");
  const attachSpec = attachRows((t) => t === "SPECIFICATII");
  const attachOther = attachRows((t) => t !== "PROIECT2D" && t !== "PROIECT3D" && t !== "SPECIFICATII");

  const taskRows: PanelRow[] = opp.tasks.map((t) => ({
    id: t.id,
    cells: [
      { text: t.name, href: `/admin/task/${t.id}` },
      { text: personName(t.assignee) },
      { text: t.type?.name ?? EMPTY },
      taskStatus(t.status?.name)
        ? { text: taskStatus(t.status?.name)!.label, badge: taskStatus(t.status?.name)!.color }
        : { text: EMPTY },
      taskPriority(t.priority?.name)
        ? { text: taskPriority(t.priority?.name)!.label, badge: taskPriority(t.priority?.name)!.color }
        : { text: EMPTY },
      { text: String(t._count.notes) },
    ],
  }));

  const noteRows: PanelRow[] = opp.notes.map((n) => ({
    id: n.id,
    cells: [
      { text: n.title },
      { text: n.body ?? "—" },
      { text: fmtDateTime(n.createdAt) },
      { text: personName(n.author) },
      { text: personName(n.recipient) },
      noteReadCell(n),
    ],
  }));

  return (
    <div className="space-y-5">
      <SetCrumb label={opp.name} />
      <PageHeader
        back={
          opp.contact
            ? { href: `/admin/contact/${opp.contact.id}`, label: `Înapoi la ${personName(opp.contact)}` }
            : { href: "/admin/opportunity", label: "Înapoi la proiecte" }
        }
        title={opp.name}
        subtitle={
          <>
            {opp.contact && (
              <>
                <Link
                  href={`/admin/contact/${opp.contact.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {personName(opp.contact)}
                </Link>{" "}
                ·{" "}
              </>
            )}
            {opp.room?.name ?? "Fără cameră"}
            {opp.staff && (
              <> · Responsabil: {personName(opp.staff)}</>
            )}
          </>
        }
        actions={
          <Link
            href={`/admin/opportunity/${opp.id}/label`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong/70 bg-card px-3.5 text-[13px] font-medium shadow-xs transition-colors hover:bg-subtle"
            title="Etichetă QR printabilă pentru atelier"
          >
            <QrCode className="h-4 w-4" /> Etichetă QR
          </Link>
        }
      />

      <StagePath
        kind="opportunity"
        entityId={opp.id}
        stages={stageRows.map((s) => ({ id: s.id, name: s.name, danger: s.name === "Asistență Juridică" }))}
        currentId={opp.stageId}
        visitedIds={opp.stageHistory.map((h) => h.stageId)}
        daysInStage={daysBetween(opp.stageEnteredAt, new Date())}
        offBoard={!!opp.stageId && !opp.onProductionBoard}
      />

      {/* esențialul proiectului dintr-o privire — fără să deschizi niciun panou */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Valoare"
          icon={Wallet}
          tone="lime"
          value={value.lei > 0 ? fmtEur(value.eur) : EMPTY}
          sub={value.lei > 0 ? fmtLei(value.lei) : "fără estimare activă"}
        />
        <StatCard
          label="Deadline"
          icon={CalendarClock}
          tone={deadlineDays != null && deadlineDays < 0 ? "red" : deadlineDays != null && deadlineDays <= 7 ? "amber" : "neutral"}
          value={opp.closeDate ? fmtDate(opp.closeDate) : EMPTY}
          sub={
            deadlineDays == null
              ? "nesetat"
              : deadlineDays < 0
                ? `depășit cu ${-deadlineDays} ${deadlineDays === -1 ? "zi" : "zile"}`
                : deadlineDays === 0
                  ? "azi"
                  : `în ${deadlineDays} ${deadlineDays === 1 ? "zi" : "zile"}`
          }
        />
        <StatCard
          label="Livrare"
          icon={Truck}
          tone="blue"
          value={opp.deliveryDate ? fmtDate(opp.deliveryDate) : EMPTY}
          sub={opp.deliveryDate ? "data promisă clientului" : "nesetată"}
        />
        <StatCard
          label="Estimări"
          icon={Calculator}
          tone="green"
          value={opp.quotes.length}
          sub={
            opp.quotes.length === 0
              ? "niciuna încă"
              : activeQuotes === opp.quotes.length
                ? activeQuotes === 1
                  ? "activă — dă valoarea proiectului"
                  : "toate active"
                : `${activeQuotes} ${activeQuotes === 1 ? "activă" : "active"} · ${opp.quotes.length - activeQuotes} ${opp.quotes.length - activeQuotes === 1 ? "variantă" : "variante"}`
          }
        />
      </div>

      <OpportunityPanels
        defaults={{
          currentUserId: String(user.id),
          reportToId: opp.contact?.staffId ? String(opp.contact.staffId) : null,
        }}
        opportunity={{
          id: opp.id,
          name: opp.name,
          description: opp.description,
          nextStep: opp.nextStep,
          competitors: opp.competitors,
          startDate: opp.startDate?.toISOString() ?? null,
          closeDate: opp.closeDate?.toISOString() ?? null,
          deliveryDate: opp.deliveryDate?.toISOString() ?? null,
          sinecost: opp.sinecost,
          stageId: opp.stageId,
          typeId: opp.typeId,
          sourceId: opp.sourceId,
          productionSequenceId: opp.productionSequenceId,
          roomName: opp.room?.name ?? null,
          roomId: opp.roomId,
          contactId: opp.contactId,
          createdAt: fmtDateTime(opp.createdAt),
        }}
        options={{ staff, stages, types, sources, prodSeq, taskTypes, taskStatuses, taskPriorities }}
        quoteRows={quoteRows}
        attach2D={attach2D}
        attach3D={attach3D}
        attachSpec={attachSpec}
        attachOther={attachOther}
        taskRows={taskRows}
        noteRows={noteRows}
        catalog={catalog}
      />
    </div>
  );
}
