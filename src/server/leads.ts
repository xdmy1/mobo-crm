// Ce au în comun lead-urile venite din afară (formularul de pe site, Meta): clientul se creează
// în etapa „Lead” cu sursa potrivită și istoricul etapei, iar vânzările sunt anunțate.

import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

/** clientul activ cu telefonul dat (forma canonică +373…), ca un lead repetat să nu devină client dublu */
export async function findContactByPhone(phone: string | null | undefined) {
  if (!phone) return null;
  return prisma.contact.findFirst({ where: { phone, deletedAt: null } });
}

export interface NewLeadContact {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** numele sursei din Setup → Surse client; primul care există câștigă (ex. ["Site", "Site Web"]) */
  sourceNames: string[];
  /** responsabilul (Staff.id) — opțional */
  staffId?: number | null;
  /** comentariul vizibil sus în fișa clientului */
  comment?: string | null;
  /** numele de familie implicit când lipsește („Site”, „Facebook”…) */
  fallbackLastName: string;
}

/** Creează clientul în etapa „Lead”, cu sursa și intrarea în istoricul etapelor. */
export async function createLeadContact(input: NewLeadContact) {
  const [stage, source] = await Promise.all([
    prisma.contactStage.findFirst({ where: { name: "Lead" } }),
    prisma.contactSource.findFirst({ where: { name: { in: input.sourceNames } }, orderBy: { order: "asc" } }),
  ]);
  return prisma.contact.create({
    data: {
      firstName: input.firstName?.trim() || "Client",
      lastName: input.lastName?.trim() || input.fallbackLastName,
      phone: input.phone || null,
      email: input.email?.trim() || null,
      comment: input.comment || null,
      staffId: input.staffId ?? null,
      stageId: stage?.id,
      sourceId: source?.id,
      stageHistory: stage ? { create: { stageId: stage.id } } : undefined,
    },
  });
}

/** Notificare in-app + push către administratori și Manager Vânzări (plus responsabilul, dacă e altcineva). */
export async function notifySales(text: string, link: string, alsoStaffId?: number | null) {
  const managers = await prisma.staff.findMany({
    where: { active: true, role: { name: { in: ["admin", "Administrator", "Manager Vânzări"] } } },
    select: { id: true },
  });
  const targets = new Set(managers.map((m) => m.id));
  if (alsoStaffId) targets.add(alsoStaffId);
  for (const id of targets) await notify(id, text, link);
}
