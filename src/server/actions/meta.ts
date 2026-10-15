"use server";

// Acțiunile din secțiunea „Meta Ads”: un lead devine client doar când apasă cineva „Creează client”;
// lead-urile greșite se resping (rămân în bază, ascunse din listă).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { personName } from "@/lib/people";
import { leadgenComment, messageComment, type LeadAnswer } from "@/lib/meta/parse";
import { createLeadContact, findContactByPhone, notifySales } from "@/server/leads";
import { META_ADS_PATH } from "@/server/meta";
import type { ActionResult } from "@/lib/listTypes";

/** Creează clientul din lead (etapa „Lead”, sursa Facebook/Instagram, responsabil = cine apasă).
 *  Dacă telefonul există deja la un client activ, lead-ul se leagă de acel client, cu o notă. */
export async function convertMetaLead(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!user.isAdmin && !can(user, "create-contact")) return { ok: false, error: "Nu ai permisiunea necesară." };

  const lead = await prisma.metaLead.findUnique({ where: { id }, include: { contact: { select: { id: true, deletedAt: true } }, messages: { orderBy: { sentAt: "asc" }, take: 1 } } });
  if (!lead) return { ok: false, error: "Lead-ul nu există." };
  if (lead.contact && !lead.contact.deletedAt) return { ok: true, id: lead.contact.id, redirect: `/admin/contact/${lead.contact.id}` };

  const platform = lead.platform === "INSTAGRAM" ? "instagram" : "facebook";
  const raw = lead.raw as { answers?: LeadAnswer[] } | null;
  const comment =
    lead.kind === "LEADGEN"
      ? leadgenComment({ adName: lead.adName, answers: raw?.answers ?? [] })
      : messageComment({ platform, adId: lead.adId, text: lead.messages[0]?.text });
  const sourceNames = [lead.platform === "INSTAGRAM" ? "Instagram" : "Facebook"];

  const existing = await findContactByPhone(lead.phone);
  let contactId: number;
  let linked = false;
  if (existing) {
    contactId = existing.id;
    linked = true;
    await prisma.note.create({ data: { title: lead.kind === "LEADGEN" ? "Formular Facebook (client existent)" : `${platform === "instagram" ? "Instagram DM" : "Messenger"} (client existent)`, body: comment, contactId, authorId: user.id } });
  } else {
    const contact = await createLeadContact({
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      sourceNames,
      staffId: user.id,
      comment,
      fallbackLastName: lead.platform === "INSTAGRAM" ? "Instagram" : "Facebook",
    });
    contactId = contact.id;
  }
  await prisma.metaLead.update({ where: { id }, data: { contactId, convertedAt: new Date(), archivedAt: null } });
  await audit(user.id, linked ? "link" : "create", "contact", contactId, { via: `meta-${lead.kind.toLowerCase()}`, metaLeadId: id });
  if (!linked) {
    await notifySales(`${personName(user)} a creat clientul ${personName(lead)} din Meta Ads.`, `/admin/contact/${contactId}`, user.id);
  }
  revalidatePath(META_ADS_PATH);
  revalidatePath(`/admin/contact/${contactId}`);
  return { ok: true, id: contactId, redirect: `/admin/contact/${contactId}` };
}

/** Respinge (sau readuce) un lead — nu se șterge nimic. */
export async function archiveMetaLead(id: number, archived: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const lead = await prisma.metaLead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) return { ok: false, error: "Lead-ul nu există." };
  await prisma.metaLead.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(user.id, archived ? "archive" : "restore", "metaLead", id);
  revalidatePath(META_ADS_PATH);
  return { ok: true, id };
}
