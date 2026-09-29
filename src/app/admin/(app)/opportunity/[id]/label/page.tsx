import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { personName } from "@/lib/people";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/** Etichetă QR printabilă pentru atelier [NOU] — scanezi → se deschide proiectul. */
export default async function OpportunityLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const oppId = parseInt(id, 10);
  if (isNaN(oppId)) notFound();

  const opp = await prisma.opportunity.findUnique({
    where: { id: oppId },
    include: { contact: true, room: true, stage: true },
  });
  if (!opp) notFound();

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/admin/opportunity/${opp.id}`;
  const qr = await QRCode.toDataURL(url, {
    width: 480,
    margin: 1,
    color: { dark: "#20211b", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-md space-y-4 print:max-w-none">
      <div className="flex items-center gap-2 print:hidden">
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight">Etichetă proiect</h1>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-white text-[#20211b] shadow-md print:rounded-none print:border print:shadow-none">
        <div className="flex items-center gap-3 bg-[#20211b] px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomobo.png" alt="Mobo" className="h-8 w-auto" />
          <span className="ml-auto rounded bg-[#ccdf10] px-2 py-0.5 text-xs font-black text-[#20211b]">
            #{opp.id}
          </span>
        </div>
        <div className="flex gap-5 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR proiect" className="h-40 w-40 shrink-0" />
          <div className="min-w-0 space-y-1.5 text-sm">
            <p className="text-lg font-black leading-tight">{opp.name}</p>
            {opp.contact && (
              <p>
                <b>Client:</b> {personName(opp.contact)}
                <br />
                <span className="text-xs text-black/60">
                  ID {opp.contact.humanId}
                  {opp.contact.phone ? ` · ${opp.contact.phone}` : ""}
                </span>
              </p>
            )}
            {opp.room && (
              <p>
                <b>Cameră:</b> {opp.room.name}
              </p>
            )}
            {opp.stage && (
              <p>
                <b>Etapa:</b> {opp.stage.name}
              </p>
            )}
            <p>
              <b>Livrare:</b>{" "}
              {fmtDate(opp.deliveryDate)}
            </p>
          </div>
        </div>
        <p className="border-t border-black/10 px-5 py-2 text-center text-[10px] text-black/50">
          Scanează codul QR pentru a deschide proiectul în MOBO CRM
        </p>
      </div>

      <p className="text-xs text-muted print:hidden">
        Sfat: printează pe hârtie autoadezivă și lipește eticheta pe piesele din
        atelier — oricine o scanează cu telefonul ajunge direct la proiect.
      </p>
    </div>
  );
}
