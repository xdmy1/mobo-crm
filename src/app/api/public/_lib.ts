import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { personName } from "@/lib/people";
import { normalizePhone } from "@/lib/phone";
import { createLeadContact, notifySales } from "@/server/leads";

// rate limiting simplu per IP (anti-spam)
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(req: NextRequest, max = 10, windowMs = 60_000): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

export function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("apiKey");
  return !!process.env.PUBLIC_API_KEY && key === process.env.PUBLIC_API_KEY;
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export interface PublicLeadInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  /** ce a completat vizitatorul pe mobo.md — ajunge într-un mesaj pe fișa clientului */
  room?: string;
  budget?: string;
  message?: string;
  /** pagina de pe site (ex. „mobo.md/calculator”) și limba în care a completat (ro / ru) */
  source?: string;
  lang?: string;
}

/** „Bucătărie” de pe site → tipul de cameră din CRM („Cameră Bucătărie”), altfel „Default”. */
async function roomTypeFor(label?: string) {
  const text = (label ?? "").toLowerCase();
  const name = /buc[aă]t|кухн|kitchen/.test(text)
    ? "Cameră Bucătărie"
    : /living|гостин/.test(text)
      ? "Cameră Living"
      : /dormitor|спальн|bedroom/.test(text)
        ? "Cameră Dormitor"
        : /garderob|dressing|гардероб/.test(text)
          ? "Cameră Garderobă"
          : /baie|ванн|bath/.test(text)
            ? "Cameră Baie"
            : /antreu|hol|прихож/.test(text)
              ? "Cameră Antreu"
              : /birou|кабинет|office/.test(text)
                ? "Cameră Birou"
                : "Default";
  return (
    (await prisma.roomType.findFirst({ where: { name } })) ??
    (await prisma.roomType.findFirst({ where: { name: "Default" } }))
  );
}

/** Detaliile cererii devin un mesaj pe fișa clientului — managerul le vede fără să caute prin estimări. */
async function saveRequestNote(contactId: number, opportunityId: number, input: PublicLeadInput, title: string) {
  const lines = [
    input.room ? `Cameră: ${input.room}` : null,
    input.budget ? `Buget: ${input.budget}` : null,
    input.message ? `Mesaj: ${input.message}` : null,
    input.lang ? `Limba: ${input.lang.toLowerCase() === "ru" ? "Rusă" : "Română"}` : null,
    input.source ? `Sursă: ${input.source}` : null,
  ].filter(Boolean);
  if (lines.length === 0) return;
  await prisma.note.create({
    data: { title, body: lines.join("\n"), contactId, opportunityId },
  });
}

/** Creează Client (Lead, sursa „Site”) + Cameră Default + Proiect + Estimare goală.
 *  Deduplicare după telefon: dacă există, returnează clientul existent. */
export async function createLeadPipeline(
  input: PublicLeadInput,
  projectName: string
) {
  const phone = normalizePhone(input.phone);
  if (phone) {
    const existing = await prisma.contact.findFirst({
      where: { phone, deletedAt: null },
      include: { opportunities: { where: { deletedAt: null } } },
    });
    if (existing) {
      // clientul există deja — adaugă doar un proiect nou pe camera Default
      const type = await roomTypeFor(input.room);
      const roomName = type?.name ?? "Default";
      let room = await prisma.room.findFirst({
        where: { contactId: existing.id, name: roomName },
      });
      if (!room) {
        room = await prisma.room.create({
          data: { contactId: existing.id, name: roomName, roomTypeId: type?.id },
        });
      }
      const opportunity = await prisma.opportunity.create({
        data: {
          name: projectName,
          roomId: room.id,
          contactId: existing.id,
          staffId: existing.staffId,
          startDate: new Date(),
          sourceId: (
            await prisma.opportunitySource.findFirst({ where: { name: projectName } })
          )?.id,
        },
      });
      await saveRequestNote(existing.id, opportunity.id, input, `${projectName} (client existent)`);
      // un client existent care revine pe site e un semnal cald — înainte nu afla nimeni
      await notifySales(
        `Clientul ${personName(existing)} (#${existing.humanId}) a trimis o cerere nouă de pe site: „${projectName}”.`,
        `/admin/contact/${existing.id}`,
        existing.staffId
      );
      return { contact: existing, room, opportunity, duplicated: true };
    }
  }

  const roomType = await roomTypeFor(input.room);
  // etapa „Lead” + sursa „Site” („Site Web” = numele vechi, dinainte de lista nouă de surse din 06.10.2026)
  const contact = await createLeadContact({
    firstName: input.firstName,
    lastName: input.lastName,
    phone,
    email: input.email,
    sourceNames: ["Site", "Site Web"],
    fallbackLastName: "Site",
  });

  const room = await prisma.room.create({
    data: { contactId: contact.id, name: roomType?.name ?? "Default", roomTypeId: roomType?.id },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      name: projectName,
      roomId: room.id,
      contactId: contact.id,
      startDate: new Date(),
      sourceId: (
        await prisma.opportunitySource.findFirst({ where: { name: projectName } })
      )?.id,
    },
  });

  await saveRequestNote(contact.id, opportunity.id, input, projectName);
  await notifySales(
    `Cerere nouă de pe site: ${personName(contact)}${phone ? ` (${phone})` : ""}.`,
    `/admin/contact/${contact.id}`
  );

  return { contact, room, opportunity, duplicated: false };
}
