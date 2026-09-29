"use server";

// Schimbarea etapelor (kanban vânzări / producere) cu regulile de business.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { claimContactIfUnassigned, putContractedProjectsOnBoard } from "@/server/workflow";
import type { ActionResult } from "@/lib/listTypes";

export async function changeContactStage(
  contactId: number,
  stageId: number,
  failureCauseId?: number | null
): Promise<ActionResult & { needsFailureCause?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-contact"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const [contact, stage] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: contactId },
      include: { stage: true, staff: true },
    }),
    prisma.contactStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!contact || !stage) return { ok: false, error: "Client sau etapă inexistentă." };
  if (contact.stageId === stageId) return { ok: true };

  // Reguli de tranziție configurabile per etapă (Setup → Etapa) [NOU: configurabil]
  if (stage.requireContract || stage.require2D || stage.require3D) {
    const [contracts, p2d, p3d] = await Promise.all([
      prisma.contract.count({ where: { contactId, kind: { not: "HANDOVER" } } }),
      prisma.attachment.count({ where: { contactId, type: "PROIECT2D" } }),
      prisma.attachment.count({ where: { contactId, type: "PROIECT3D" } }),
    ]);
    const missing: string[] = [];
    if (stage.requireContract && contracts === 0) missing.push("contract");
    if (stage.require2D && p2d === 0) missing.push("proiect2D");
    if (stage.require3D && p3d === 0) missing.push("proiect3D");
    if (missing.length) {
      return {
        ok: false,
        error: `Nu e posibil să schimbi etapa fără ${missing.join(", ")}.`,
      };
    }
  }

  if (stage.requireFailureCause && !failureCauseId && !contact.failureCauseId) {
    return { ok: false, needsFailureCause: true, error: "Selectați cauza eșecului." };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.contactStageHistory.updateMany({
      where: { contactId, leftAt: null },
      data: { leftAt: now },
    }),
    prisma.contactStageHistory.create({
      data: { contactId, stageId, enteredAt: now },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: {
        stageId,
        stageEnteredAt: now,
        failureCauseId: failureCauseId ?? contact.failureCauseId,
      },
    }),
  ]);

  if (stage.notifyOnEnter) {
    const text = `Clientul ${contact.firstName} ${contact.lastName} a fost aprobat să treacă la etapa „${stage.name}”.`;
    const targets = new Set<number>();
    if (contact.staffId) targets.add(contact.staffId);
    targets.add(user.id);
    for (const t of targets) {
      await notify(t, text, `/admin/contact/${contactId}`);
    }
  }

  await audit(user.id, "stage-change", "contact", contactId, {
    from: contact.stage?.name,
    to: stage.name,
  });

  await claimContactIfUnassigned(contactId, user.id);
  // predat în producere → proiectele contractate apar singure pe Bordul Producere
  if (stage.name === "Predat Producere") await putContractedProjectsOnBoard(contactId, user.id);

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function changeOpportunityStage(
  opportunityId: number,
  stageId: number
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-opportunity"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const [opp, stage] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { stage: true },
    }),
    prisma.opportunityStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!opp || !stage) return { ok: false, error: "Proiect sau etapă inexistentă." };
  // aceeași etapă, dar proiectul fusese scos de pe bord → alegerea etapei îl readuce
  if (opp.stageId === stageId && opp.onProductionBoard) return { ok: true };

  const now = new Date();
  await prisma.$transaction([
    prisma.opportunityStageHistory.updateMany({
      where: { opportunityId, leftAt: null },
      data: { leftAt: now },
    }),
    prisma.opportunityStageHistory.create({
      data: { opportunityId, stageId, enteredAt: now },
    }),
    prisma.opportunity.update({
      where: { id: opportunityId },
      data: { stageId, stageEnteredAt: now, onProductionBoard: true },
    }),
  ]);

  await audit(user.id, "stage-change", "opportunity", opportunityId, {
    from: opp.stage?.name,
    to: stage.name,
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Scoate proiectul de pe bordul de producere (✖ pe card). */
export async function removeOpportunityFromBoard(
  opportunityId: number
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-opportunity"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  // etapa rămâne pe proiect (se vede în listă și în fișă); se închide doar perioada din istoric,
  // ca timpul pe etape din dashboard să nu mai curgă pentru un proiect scos de pe bord
  await prisma.$transaction([
    prisma.opportunityStageHistory.updateMany({
      where: { opportunityId, leftAt: null },
      data: { leftAt: new Date() },
    }),
    prisma.opportunity.update({
      where: { id: opportunityId },
      data: { onProductionBoard: false },
    }),
  ]);
  await audit(user.id, "board-remove", "opportunity", opportunityId);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
