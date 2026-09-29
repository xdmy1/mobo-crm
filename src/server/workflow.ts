// Automatizările fluxului de lucru: lucrurile pe care sistemul le știe deja nu se mai fac de mână.
// (Fișier simplu de server, NU „use server” — funcțiile de aici nu sunt expuse ca acțiuni publice.)

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { personName } from "@/lib/people";

/**
 * Mută clientul ÎNAINTE la etapa cerută — niciodată înapoi și niciodată peste regulile etapei
 * (contract / 2D / 3D). Apelată când se întâmplă ceva care dovedește etapa:
 * estimare salvată → Calcule, ofertă → Prezentare, contract → Contractat.
 * Întoarce numele etapei noi sau null dacă nu s-a schimbat nimic.
 */
export async function advanceContactTo(
  contactId: number,
  stageName: string,
  userId: number,
  reason: string
): Promise<string | null> {
  const [contact, target] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId }, include: { stage: true } }),
    prisma.contactStage.findFirst({ where: { name: stageName } }),
  ]);
  if (!contact || !target || contact.deletedAt) return null;
  // un client marcat „Eșuat” se redeschide doar manual
  if (contact.stage?.requireFailureCause) return null;
  if (contact.stage && target.order <= contact.stage.order) return null;

  if (target.requireContract || target.require2D || target.require3D) {
    const [contracts, p2d, p3d] = await Promise.all([
      prisma.contract.count({ where: { contactId, kind: { not: "HANDOVER" } } }),
      prisma.attachment.count({ where: { contactId, type: "PROIECT2D" } }),
      prisma.attachment.count({ where: { contactId, type: "PROIECT3D" } }),
    ]);
    if (
      (target.requireContract && contracts === 0) ||
      (target.require2D && p2d === 0) ||
      (target.require3D && p3d === 0)
    )
      return null;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.contactStageHistory.updateMany({
      where: { contactId, leftAt: null },
      data: { leftAt: now },
    }),
    prisma.contactStageHistory.create({ data: { contactId, stageId: target.id, enteredAt: now } }),
    prisma.contact.update({
      where: { id: contactId },
      data: {
        stageId: target.id,
        stageEnteredAt: now,
        // clientul fără responsabil îl primește pe cel care lucrează efectiv cu el
        ...(contact.staffId ? {} : { staffId: userId }),
      },
    }),
  ]);

  if (target.notifyOnEnter && contact.staffId && contact.staffId !== userId) {
    await notify(
      contact.staffId,
      `Clientul ${personName(contact)} a trecut la etapa „${target.name}”.`,
      `/admin/contact/${contactId}`
    );
  }
  await audit(userId, "stage-change", "contact", contactId, {
    from: contact.stage?.name,
    to: target.name,
    auto: reason,
  });
  return target.name;
}

/** Clientul fără responsabil îl primește pe primul om care îi schimbă etapa. */
export async function claimContactIfUnassigned(contactId: number, userId: number) {
  await prisma.contact.updateMany({
    where: { id: contactId, staffId: null },
    data: { staffId: userId },
  });
}

/**
 * Când clientul e „Predat Producere”, proiectele lui contractate apar singure pe Bordul Producere
 * (prima etapă). Înainte trebuiau puse de mână — iar dintr-o pagină care nici nu seta bordul.
 */
export async function putContractedProjectsOnBoard(contactId: number, userId: number): Promise<number> {
  const first = await prisma.opportunityStage.findFirst({ orderBy: { order: "asc" } });
  if (!first) return 0;

  const linked = await prisma.opportunity.findMany({
    where: {
      contactId,
      deletedAt: null,
      contracts: { some: { contract: { kind: { not: "HANDOVER" } } } },
    },
  });
  // fără contract legat de proiecte: toate proiectele clientului care au o estimare activă
  const projects = linked.length
    ? linked
    : await prisma.opportunity.findMany({
        where: { contactId, deletedAt: null, quotes: { some: { deletedAt: null, active: true } } },
      });

  const now = new Date();
  let moved = 0;
  for (const p of projects) {
    if (p.onProductionBoard && p.stageId) continue;
    const stageId = p.stageId ?? first.id;
    await prisma.$transaction([
      prisma.opportunityStageHistory.updateMany({
        where: { opportunityId: p.id, leftAt: null },
        data: { leftAt: now },
      }),
      prisma.opportunityStageHistory.create({
        data: { opportunityId: p.id, stageId, enteredAt: now },
      }),
      prisma.opportunity.update({
        where: { id: p.id },
        data: { stageId, stageEnteredAt: now, onProductionBoard: true },
      }),
    ]);
    await audit(userId, "stage-change", "opportunity", p.id, {
      to: first.name,
      auto: "client predat în producere",
    });
    moved++;
  }
  return moved;
}

/** O singură estimare activă per proiect: cea nouă o înlocuiește pe cea veche la valoare. */
export async function deactivateSiblingQuotes(opportunityId: number, keepQuoteId: number) {
  await prisma.quote.updateMany({
    where: { opportunityId, id: { not: keepQuoteId }, active: true, deletedAt: null },
    data: { active: false },
  });
}
