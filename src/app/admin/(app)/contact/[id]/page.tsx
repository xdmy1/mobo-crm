import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { daysBetween, fmtDate, fmtDateTime, fmtEur, fmtEurLei, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { countedQuotes, roomSum, sumQuotes } from "@/lib/sums";
import { opportunityStageColor } from "@/lib/status";
import { SetCrumb } from "@/components/layout/Crumb";
import { StagePath } from "@/components/workflow/StagePath";
import {
  staffOptions,
  contactStageOptions,
  contactSourceOptions,
  roomTypeOptions,
  failureCauseOptions,
} from "@/server/options";
import { getDocOptions } from "@/server/docOptions";
import { noteReadCell } from "@/lib/messages";
import {
  ContractCreateButton,
  HandoverCreateButton,
  OfferCreateButton,
} from "@/components/documents/ContractCreateButton";
import { PresentationCreateButton } from "@/components/documents/PresentationCreateButton";
import { ContactSidebar } from "./ContactSidebar";
import { ContactPanels, type PanelRow, type TimelineItem } from "./ContactPanels";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const contactId = parseInt(id, 10);
  if (isNaN(contactId)) notFound();

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
    include: {
      staff: true,
      stage: true,
      source: true,
      company: true,
      productionSequence: true,
      rooms: { orderBy: { createdAt: "desc" } },
      contracts: {
        orderBy: { createdAt: "desc" },
        include: { opportunities: { include: { opportunity: true } } },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: true, recipient: true },
      },
      offers: { orderBy: { createdAt: "desc" }, include: { room: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      opportunities: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { room: true, stage: true, quotes: true },
      },
      stageHistory: {
        orderBy: { enteredAt: "desc" },
        include: { stage: true },
      },
    },
  });
  if (!contact) notFound();

  const [staff, stages, sources, roomTypes, causes, docOpts, stageRows] =
    await Promise.all([
      staffOptions(),
      contactStageOptions(),
      contactSourceOptions(),
      roomTypeOptions(),
      failureCauseOptions(),
      getDocOptions(contactId),
      prisma.contactStage.findMany({ orderBy: { order: "asc" } }),
    ]);

  // sume camere — aceeași regulă ca peste tot (doar estimările active), din lib/sums
  const roomRows: PanelRow[] = await Promise.all(
    contact.rooms.map(async (r) => {
      const { eur, lei } = await roomSum(r.id);
      return {
        id: r.id,
        cells: [
          { text: r.name, href: `/admin/room/${r.id}` },
          { text: fmtEurLei(eur, lei) },
          { text: fmtDateTime(r.createdAt) },
          { text: fmtDateTime(r.updatedAt) },
        ],
        raw: { roomTypeId: r.roomTypeId ? String(r.roomTypeId) : null, name: r.name },
      };
    })
  );

  const contractRows: PanelRow[] = contact.contracts.map((c) => ({
    id: c.id,
    cells: [
      { text: c.fileName },
      { text: personName(contact) },
      { text: c.opportunities.map((o) => o.opportunity.name).join(", ") || EMPTY },
      { text: c.retribution != null ? fmtEur(c.retribution) : EMPTY },
      { text: fmtDateTime(c.createdAt) },
    ],
    downloadHref: c.filePath
      ? `/api/files/${encodeURIComponent(c.filePath)}?download=1`
      : undefined,
  }));

  const noteRows: PanelRow[] = contact.notes.map((n) => ({
    id: n.id,
    cells: [
      { text: n.title },
      { text: n.body ?? EMPTY },
      { text: fmtDateTime(n.createdAt) },
      { text: personName(n.author) },
      { text: personName(n.recipient) },
      noteReadCell(n),
    ],
  }));

  // proiectele clientului — legătura directă client → proiect → estimare, care lipsea din fișă
  const projectRows: PanelRow[] = contact.opportunities.map((o) => {
    const { eur, lei } = sumQuotes(countedQuotes(o.quotes));
    return {
      id: o.id,
      cells: [
        { text: o.name, href: `/admin/opportunity/${o.id}` },
        { text: o.room?.name ?? EMPTY, href: o.room ? `/admin/room/${o.room.id}` : undefined },
        o.stage
          ? { text: o.stage.name, badge: opportunityStageColor(o.stage.name) }
          : { text: EMPTY },
        { text: lei > 0 ? fmtEurLei(eur, lei) : EMPTY },
        { text: fmtDate(o.closeDate) },
      ],
    };
  });

  const offerRows: PanelRow[] = contact.offers.map((o) => ({
    id: o.id,
    cells: [
      { text: o.fileName },
      { text: o.room?.name ?? "Toate camerele" },
      { text: o.language },
      { text: fmtDateTime(o.createdAt) },
    ],
    downloadHref: o.filePath ? `/api/files/${encodeURIComponent(o.filePath)}?download=1` : undefined,
  }));

  // Timeline unificat [NOU]
  const timeline: TimelineItem[] = [
    ...contact.stageHistory.map((h) => ({
      when: h.enteredAt.toISOString(),
      whenText: fmtDateTime(h.enteredAt),
      kind: "etapă",
      text: `A intrat în etapa „${h.stage.name}”`,
    })),
    ...contact.notes.map((n) => ({
      when: n.createdAt.toISOString(),
      whenText: fmtDateTime(n.createdAt),
      kind: "mesaj",
      text: `Mesaj: „${n.title}”${n.author ? ` — ${personName(n.author)}` : ""}`,
    })),
    ...contact.contracts.map((c) => ({
      when: c.createdAt.toISOString(),
      whenText: fmtDateTime(c.createdAt),
      kind: c.kind === "HANDOVER" ? "predat/preluat" : "contract",
      text: `${c.kind === "HANDOVER" ? "Proces-verbal" : "Contract"}: ${c.fileName}`,
    })),
    ...contact.offers.map((o) => ({
      when: o.createdAt.toISOString(),
      whenText: fmtDateTime(o.createdAt),
      kind: "ofertă",
      text: `Ofertă: ${o.fileName}`,
    })),
    ...contact.attachments.map((a) => ({
      when: a.createdAt.toISOString(),
      whenText: fmtDateTime(a.createdAt),
      kind: "atașament",
      text: `Atașament (${a.type}): ${a.name}`,
    })),
    ...contact.opportunities.map((o) => ({
      when: o.createdAt.toISOString(),
      whenText: fmtDateTime(o.createdAt),
      kind: "proiect",
      text: `Proiect creat: ${o.name}`,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  const dangerStageIds = new Set(stageRows.filter((s) => s.requireFailureCause).map((s) => s.id));

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <SetCrumb label={personName(contact)} />
      <ContactSidebar
        contact={{
          id: contact.id,
          humanId: contact.humanId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          comment: contact.comment,
          idnp: contact.idnp,
          birthDate: contact.birthDate?.toISOString() ?? null,
          deliveryAddress: contact.deliveryAddress,
          homeAddress: contact.homeAddress,
          presentCountry: contact.presentCountry,
          staffId: contact.staffId,
          stageId: contact.stageId,
          sourceId: contact.sourceId,
          company: contact.company ? { id: contact.company.id, name: contact.company.name } : null,
        }}
        options={{ staff, stages, sources, causes }}
        canDelete={user.isAdmin || user.permissions.has("delete-contact")}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <StagePath
          kind="contact"
          entityId={contact.id}
          stages={stageRows.map((s) => ({ id: s.id, name: s.name, danger: dangerStageIds.has(s.id) }))}
          currentId={contact.stageId}
          visitedIds={contact.stageHistory.map((h) => h.stageId)}
          daysInStage={daysBetween(contact.stageEnteredAt, new Date())}
          failureCauses={causes}
        />

        <div className="flex flex-wrap gap-2">
          <ContractCreateButton
            variant="create"
            contacts={docOpts.contacts}
            rooms={docOpts.rooms}
            opportunities={docOpts.opportunities}
            fixedContactId={contact.id}
            label="Creare Contract"
          />
          <HandoverCreateButton
            contacts={docOpts.contacts}
            rooms={docOpts.rooms}
            opportunities={docOpts.opportunities}
            fixedContactId={contact.id}
            defaultIdnp={contact.idnp}
          />
          <OfferCreateButton
            contacts={docOpts.contacts}
            rooms={docOpts.rooms}
            fixedContactId={contact.id}
          />
          <PresentationCreateButton
            contacts={docOpts.contacts}
            fixedContactId={contact.id}
          />
        </div>

        <ContactPanels
          contactId={contact.id}
          contactName={personName(contact)}
          defaultRecipientId={
            contact.staffId && contact.staffId !== user.id ? String(contact.staffId) : null
          }
          projectRows={projectRows}
          roomTypeIds={contact.rooms.map((r) => r.roomTypeId).filter((id): id is number => id != null)}
          offerRows={offerRows}
          roomRows={roomRows}
          contractRows={contractRows}
          noteRows={noteRows}
          timeline={timeline}
          roomTypes={roomTypes}
          staff={staff}
          phone={contact.phone}
          email={contact.email}
        />
      </div>
    </div>
  );
}
