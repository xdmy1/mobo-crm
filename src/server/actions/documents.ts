"use server";

// Generarea documentelor: Contract PDF, Ofertă PDF, Predat/Preluat DOCX.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveDocFile } from "@/lib/pdf/core";
import {
  generateContractPdf,
  generateOfferPdf,
} from "@/lib/pdf/generators";
import { generateHandoverDocx } from "@/lib/docx/handover";
import { roomSum, opportunitySum } from "@/lib/sums";
import { fmtEurLei } from "@/lib/format";
import { personName } from "@/lib/people";
import { advanceContactTo } from "@/server/workflow";
import type { ActionResult } from "@/lib/listTypes";
import type { Lang } from "@/lib/pdf/texts";

async function getOrg() {
  return (
    (await prisma.organization.findUnique({ where: { id: 1 } })) ?? {
      name: "Mobo kitchens & home",
      idno: null,
      address: null,
      phone: null,
      email: null,
      partnerPercent: 10,
      designerPercent: 5,
      qcDefault: 1200,
    }
  );
}

const sanitize = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_");

export async function createContract(values: {
  contactId?: string | null;
  companyId?: string | null;
  roomIds?: string[];
  opportunityIds?: string[];
  retribution?: string;
  financialGuarantee?: string;
  beneficiaryPercent?: string;
  language?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-contract"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const contactId = values.contactId ? parseInt(values.contactId, 10) : null;
  const companyId = values.companyId ? parseInt(values.companyId, 10) : null;
  if (!contactId && !companyId)
    return { ok: false, error: "Selectați clientul sau persoana juridică." };

  const retribution = parseFloat(String(values.retribution ?? "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const lang = (values.language === "RU" ? "RU" : "RO") as Lang;
  const roomIds = (values.roomIds ?? []).map(Number).filter(Boolean);
  const oppIds = (values.opportunityIds ?? []).map(Number).filter(Boolean);

  const [org, contact, company, rooms, opportunities] = await Promise.all([
    getOrg(),
    contactId ? prisma.contact.findUnique({ where: { id: contactId } }) : null,
    companyId ? prisma.company.findUnique({ where: { id: companyId } }) : null,
    prisma.room.findMany({ where: { id: { in: roomIds } } }),
    prisma.opportunity.findMany({
      where: { id: { in: oppIds } },
      include: { room: true },
    }),
  ]);

  const clientName = contact ? personName(contact) : company?.name ?? "";
  const fileName = `${sanitize(clientName)}_contract.pdf`;

  const projectRows = await Promise.all(
    opportunities.map(async (o) => {
      const s = await opportunitySum(o.id);
      return {
        name: o.name,
        room: o.room?.name ?? "—",
        sum: fmtEurLei(s.eur, s.lei),
      };
    })
  );
  const roomRows = await Promise.all(
    rooms.map(async (r) => {
      const s = await roomSum(r.id);
      return { name: r.name, sum: fmtEurLei(s.eur, s.lei) };
    })
  );

  // creăm întâi rândul ca să obținem numărul din secvența DB, apoi generăm PDF-ul
  const contract = await prisma.contract.create({
    data: {
      fileName,
      kind: contact ? "CLIENT" : "COMPANY",
      contactId,
      companyId,
      retribution,
      financialGuarantee: parseFloat(values.financialGuarantee ?? "15") || 15,
      beneficiaryPercent: parseFloat(values.beneficiaryPercent ?? "15") || 15,
      language: lang,
      rooms: { create: roomIds.map((roomId) => ({ roomId })) },
      opportunities: { create: oppIds.map((opportunityId) => ({ opportunityId })) },
      finance: {
        create: {
          contractSumEur: retribution,
          procentQc: org.qcDefault,
        },
      },
    },
  });

  const pdf = await generateContractPdf({
    number: contract.number,
    lang,
    org: { name: org.name, idno: org.idno, address: org.address, phone: org.phone, email: org.email },
    clientName,
    clientIdnp: contact?.idnp ?? company?.idno,
    clientAddress: contact?.deliveryAddress ?? company?.legalStreet,
    clientPhone: contact?.phone ?? company?.phone,
    isCompany: !contact,
    retribution,
    financialGuarantee: parseFloat(values.financialGuarantee ?? "15") || 15,
    beneficiaryPercent: parseFloat(values.beneficiaryPercent ?? "15") || 15,
    rooms: roomRows,
    projects: projectRows.length
      ? projectRows
      : roomRows.map((r) => ({ name: "—", room: r.name, sum: r.sum })),
  });
  const filePath = await saveDocFile(pdf, fileName);
  await prisma.contract.update({
    where: { id: contract.id },
    data: { filePath },
  });

  await audit(user.id, "create", "contract", contract.id);
  // un contract dovedește etapa „Contractat” (dacă regulile etapei sunt îndeplinite)
  if (contactId) await advanceContactTo(contactId, "Contractat", user.id, "contract creat");
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    id: contract.id,
    downloadUrl: `/api/files/${encodeURIComponent(filePath)}?download=1`,
  };
}

export async function createHandover(values: {
  contactId?: string | null;
  roomId?: string | null;
  opportunityIds?: string[];
  idnp?: string;
  language?: string;
  /** Semnătura clientului de pe tabletă (PNG dataURL) [NOU] */
  signature?: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-contract"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const contactId = values.contactId ? parseInt(values.contactId, 10) : null;
  if (!contactId) return { ok: false, error: "Selectați clientul." };
  const roomId = values.roomId ? parseInt(values.roomId, 10) : null;
  const oppIds = (values.opportunityIds ?? []).map(Number).filter(Boolean);
  const lang = (values.language === "RU" ? "RU" : "RO") as Lang;

  const [org, contact, room, opportunities] = await Promise.all([
    getOrg(),
    prisma.contact.findUnique({ where: { id: contactId } }),
    roomId ? prisma.room.findUnique({ where: { id: roomId } }) : null,
    prisma.opportunity.findMany({ where: { id: { in: oppIds } } }),
  ]);
  if (!contact) return { ok: false, error: "Client inexistent." };

  const clientName = personName(contact);
  const fileName = `${sanitize(clientName)}_predat_preluat.docx`;

  // semnătura de pe tabletă [NOU]
  let signaturePng: Buffer | null = null;
  let signedFilePath: string | null = null;
  if (values.signature?.startsWith("data:image/png;base64,")) {
    signaturePng = Buffer.from(
      values.signature.slice("data:image/png;base64,".length),
      "base64"
    );
    signedFilePath = await saveDocFile(
      signaturePng,
      `${sanitize(clientName)}_semnatura.png`
    );
  }

  const buf = await generateHandoverDocx({
    lang,
    orgName: org.name,
    clientName,
    idnp: values.idnp || contact.idnp || "—",
    roomName: room?.name ?? "—",
    projects: opportunities.map((o) => o.name),
    signaturePng,
  });
  const filePath = await saveDocFile(buf, fileName);

  const contract = await prisma.contract.create({
    data: {
      fileName,
      kind: "HANDOVER",
      contactId,
      language: lang,
      filePath,
      signedFilePath,
      status: signaturePng ? "SEMNAT" : "DRAFT",
      idnp: values.idnp || contact.idnp,
      rooms: roomId ? { create: [{ roomId }] } : undefined,
      opportunities: { create: oppIds.map((opportunityId) => ({ opportunityId })) },
    },
  });

  await audit(user.id, "create", "handover", contract.id);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    id: contract.id,
    downloadUrl: `/api/files/${encodeURIComponent(filePath)}?download=1`,
  };
}

export async function deleteContract(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "delete-contract"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  await prisma.contract.delete({ where: { id } });
  await audit(user.id, "delete", "contract", id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteOffer(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "delete-offer"))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  await prisma.offer.delete({ where: { id } });
  await audit(user.id, "delete", "offer", id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function createOffer(values: {
  contactId?: string | null;
  roomId?: string | null;
  showStagePrices?: boolean;
  language?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-offer"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const contactId = values.contactId ? parseInt(values.contactId, 10) : null;
  if (!contactId) return { ok: false, error: "Selectați clientul." };
  const roomId = values.roomId ? parseInt(values.roomId, 10) : null;
  const lang = (values.language === "RU" ? "RU" : "RO") as Lang;

  const [org, contact, room] = await Promise.all([
    getOrg(),
    prisma.contact.findUnique({ where: { id: contactId } }),
    roomId ? prisma.room.findUnique({ where: { id: roomId } }) : null,
  ]);
  if (!contact) return { ok: false, error: "Client inexistent." };

  const opportunities = await prisma.opportunity.findMany({
    where: {
      deletedAt: null,
      contactId,
      ...(roomId ? { roomId } : {}),
    },
    include: { room: true },
  });
  const items = await Promise.all(
    opportunities.map(async (o) => {
      const s = await opportunitySum(o.id);
      return {
        project: o.name,
        room: o.room?.name ?? "—",
        priceEur: s.eur,
        priceMdl: s.lei,
      };
    })
  );

  const clientName = personName(contact);
  const fileName = `${sanitize(clientName)}_offer.pdf`;
  const pdf = await generateOfferPdf({
    lang,
    org: { name: org.name, idno: org.idno, address: org.address, phone: org.phone, email: org.email },
    clientName,
    roomName: room?.name,
    showStagePrices: values.showStagePrices !== false,
    items,
  });
  const filePath = await saveDocFile(pdf, fileName);

  const offer = await prisma.offer.create({
    data: {
      fileName,
      contactId,
      roomId,
      showStagePrices: values.showStagePrices !== false,
      language: lang,
      filePath,
    },
  });

  await audit(user.id, "create", "offer", offer.id);
  await advanceContactTo(contactId, "Prezentare", user.id, "ofertă creată");
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    id: offer.id,
    downloadUrl: `/api/files/${encodeURIComponent(filePath)}?download=1`,
  };
}
