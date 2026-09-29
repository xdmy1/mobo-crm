"use server";

// „Asistentul”: acțiuni mici care scot munca repetitivă din mâna omului —
// precompletări din ce știe deja sistemul, căutare de dubluri în timp ce tastezi,
// proiect nou dintr-un singur pas, următoarea acțiune pe client.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { personName } from "@/lib/people";
import { quoteTotals, round2 } from "@/lib/sums";
import type { ActionResult } from "@/lib/listTypes";

/** Contract nou: camerele, proiectele și prețul sunt deja în sistem — nu se mai aleg/tastează de mână. */
export async function contractDefaults(contactId: number): Promise<{
  roomIds: string[];
  opportunityIds: string[];
  retributionEur: number;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  // proiectele cu estimare activă sunt cele care se contractează
  const projects = await prisma.opportunity.findMany({
    where: { contactId, deletedAt: null, quotes: { some: { deletedAt: null, active: true } } },
    select: { id: true, roomId: true },
  });
  const total = await quoteTotals({ opportunity: { contactId } });
  return {
    roomIds: [...new Set(projects.map((p) => p.roomId).filter((id): id is number => id != null))].map(String),
    opportunityIds: projects.map((p) => String(p.id)),
    retributionEur: round2(total.eur),
  };
}

/** În timp ce tastezi telefonul unui client nou: există deja? (același număr, oricum ar fi scris) */
export async function findContactByPhone(
  raw: string
): Promise<{ id: number; name: string; humanId: string; stage: string | null; staff: string | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const phone = normalizePhone(raw);
  if (!phone || phone.replace(/\D/g, "").length < 8) return null;
  const c = await prisma.contact.findFirst({
    where: { phone, deletedAt: null },
    include: { stage: true, staff: true },
  });
  return c
    ? { id: c.id, name: personName(c), humanId: c.humanId, stage: c.stage?.name ?? null, staff: c.staff ? personName(c.staff) : null }
    : null;
}

/**
 * Proiect nou dintr-un singur pas, direct din fișa clientului: camera se refolosește sau se creează,
 * numele și responsabilul se completează singure. Înainte: adaugă cameră → deschide camera →
 * formular de 5 câmpuri → deschide proiectul → deschide Bordul Tehnic.
 */
export async function quickProject(values: {
  contactId: number;
  roomTypeId: number;
  name?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-opportunity")) return { ok: false, error: "Nu ai permisiunea necesară." };

  const [contact, roomType] = await Promise.all([
    prisma.contact.findFirst({ where: { id: values.contactId, deletedAt: null } }),
    prisma.roomType.findUnique({ where: { id: values.roomTypeId } }),
  ]);
  if (!contact || !roomType) return { ok: false, error: "Client sau cameră inexistentă." };

  const room =
    (await prisma.room.findFirst({ where: { contactId: contact.id, roomTypeId: roomType.id } })) ??
    (await prisma.room.create({ data: { contactId: contact.id, roomTypeId: roomType.id, name: roomType.name } }));

  const label = roomType.name.replace(/^Cameră\s+/i, "");
  const name = values.name?.trim() || `${label === "Default" ? "Proiect" : label} ${contact.lastName}`.trim();
  const opp = await prisma.opportunity.create({
    data: {
      name,
      roomId: room.id,
      contactId: contact.id,
      staffId: contact.staffId ?? user.id,
      startDate: new Date(),
    },
  });
  await audit(user.id, "create", "opportunity", opp.id, { quick: true });
  revalidatePath("/admin", "layout");
  return { ok: true, id: opp.id, redirect: `/admin/opportunity/${opp.id}?wizard=1` };
}

/** Următoarea acțiune pe client („sună joi pentru măsurare”) — apare pe dashboard în ziua respectivă. */
export async function setNextAction(
  contactId: number,
  text: string | null,
  date: string | null
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "update-contact")) return { ok: false, error: "Nu ai permisiunea necesară." };
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      nextAction: text?.trim() || null,
      // la prânz, ca ziua să rămână aceeași indiferent de fusul orar al serverului
      nextActionDate: date ? new Date(`${date}T12:00:00`) : null,
    },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}
