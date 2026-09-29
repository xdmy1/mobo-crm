import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtEurLei, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { opportunityStageColor } from "@/lib/status";
import { SetCrumb } from "@/components/layout/Crumb";
import { staffOptions, roomTypeOptions } from "@/server/options";
import { opportunitySum } from "@/lib/sums";
import { RoomPanels } from "./RoomPanels";
import type { PanelRow } from "../../contact/[id]/ContactPanels";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const roomId = parseInt(id, 10);
  if (isNaN(roomId)) notFound();

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      contact: true,
      attachments: { orderBy: { createdAt: "desc" }, include: { staff: true } },
      opportunities: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { stage: true, type: true, source: true },
      },
    },
  });
  if (!room) notFound();

  const [staff, roomTypes] = await Promise.all([staffOptions(), roomTypeOptions()]);

  const attachmentRows: PanelRow[] = room.attachments.map((a) => ({
    id: a.id,
    cells: [
      { text: a.name },
      { text: personName(a.staff) },
      { text: fmtDateTime(a.createdAt) },
    ],
    downloadHref: `/api/files/${encodeURIComponent(a.filePath)}?download=1`,
  }));

  const projectRows: PanelRow[] = await Promise.all(
    room.opportunities.map(async (o) => {
      const s = await opportunitySum(o.id);
      return {
        id: o.id,
        cells: [
          { text: o.name, href: `/admin/opportunity/${o.id}` },
          { text: s.lei > 0 ? fmtEurLei(s.eur, s.lei) : EMPTY },
          o.stage ? { text: o.stage.name, badge: opportunityStageColor(o.stage.name) } : { text: EMPTY },
          { text: o.type?.name ?? EMPTY },
          { text: fmtDateTime(o.createdAt) },
        ],
      };
    })
  );

  return (
    <div className="space-y-5">
      <SetCrumb label={`${personName(room.contact)} · ${room.name}`} />
      <PageHeader
        back={{ href: `/admin/contact/${room.contactId}`, label: "Înapoi la client" }}
        title={room.name}
        subtitle={
          <>
            Camera clientului{" "}
            <Link
              href={`/admin/contact/${room.contactId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {personName(room.contact)}
            </Link>{" "}
            · ID client {room.contact.humanId}
          </>
        }
      />

      <RoomPanels
        roomId={room.id}
        contactId={room.contactId}
        roomName={room.name}
        contactLastName={room.contact.lastName}
        defaults={{
          currentUserId: String(user.id),
          contactStaffId: room.contact.staffId ? String(room.contact.staffId) : null,
        }}
        attachmentRows={attachmentRows}
        projectRows={projectRows}
        staff={staff}
        roomTypes={roomTypes}
      />
    </div>
  );
}
