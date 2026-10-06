// Registrul entităților pentru CRUD-ul generic (whitelist server-side).
// Fiecare cheie = entitate expusă către client prin saveRecord/deleteRecords.

import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { notify } from "@/lib/notify";
import { notifyNewMessage } from "@/lib/messages";
import { generateHumanId } from "@/lib/humanId";
import bcrypt from "bcryptjs";

export type FieldKind = "string" | "number" | "int" | "date" | "bool" | "stringArray";

export interface EntityConfig {
  model: string;
  /** modulul de permisiuni: create-<module> etc. */
  module: string;
  fields: Record<string, FieldKind>;
  softDelete?: boolean;
  beforeSave?: (
    values: Record<string, unknown>,
    userId: number,
    isCreate: boolean
  ) => Promise<Record<string, unknown>>;
  afterSave?: (
    id: number,
    values: Record<string, unknown>,
    userId: number,
    isCreate: boolean
  ) => Promise<void>;
}

const simple = (model: string, module = "setup"): EntityConfig => ({
  model,
  module,
  fields: { name: "string" },
});

export const REGISTRY: Record<string, EntityConfig> = {
  // ── Nomenclatoare Setup ──
  contactStage: {
    model: "contactStage",
    module: "setup",
    fields: {
      name: "string",
      order: "int",
      requireContract: "bool",
      require2D: "bool",
      require3D: "bool",
      requireFailureCause: "bool",
      notifyOnEnter: "bool",
    },
  },
  contactSource: {
    model: "contactSource",
    module: "setup",
    fields: { name: "string", code: "string", order: "int" },
    beforeSave: async (values, _userId, isCreate) => {
      // o sursă nouă fără ordine merge la coada listei; la editare, o ordine ștearsă rămâne cum era
      if (values.order === null || values.order === undefined) {
        if (isCreate) {
          const last = await prisma.contactSource.aggregate({ _max: { order: true } });
          values.order = (last._max.order ?? 0) + 1;
        } else delete values.order;
      }
      return values;
    },
  },
  failureCause: simple("failureCause"),
  productionSequence: simple("productionSequence"),
  roomType: {
    model: "roomType",
    module: "setup",
    fields: { name: "string", elements: "stringArray" },
  },
  opportunityStage: {
    model: "opportunityStage",
    module: "setup",
    fields: { name: "string", order: "int", phase: "string" },
  },
  opportunityType: simple("opportunityType"),
  opportunitySource: simple("opportunitySource"),
  quoteStage: simple("quoteStage"),
  taskType: simple("taskType"),
  taskStatus: simple("taskStatus"),
  taskPriority: simple("taskPriority"),
  companyType: simple("companyType"),
  industry: simple("industry"),
  department: simple("department"),
  designation: simple("designation"),
  employmentStatus: simple("employmentStatus"),
  shift: {
    model: "shift",
    module: "setup",
    fields: { name: "string", startTime: "string", endTime: "string" },
  },
  productCategory: { model: "productCategory", module: "productCategory", fields: { name: "string" } },
  announcement: {
    model: "announcement",
    module: "announcement",
    fields: { title: "string", body: "string", date: "date" },
  },
  award: {
    model: "award",
    module: "award",
    fields: { name: "string", description: "string", date: "date" },
  },
  partner: {
    model: "partner",
    module: "setup",
    fields: { name: "string", phone: "string", commissionPercent: "number" },
  },
  designerPartner: {
    model: "designerPartner",
    module: "setup",
    fields: { name: "string", phone: "string", commissionPercent: "number" },
  },
  account: {
    model: "account",
    module: "account",
    fields: { name: "string", type: "string" },
  },
  transaction: {
    model: "transaction",
    module: "transaction",
    fields: {
      date: "date",
      debitAccountId: "int",
      creditAccountId: "int",
      amount: "number",
      description: "string",
      contractId: "int",
    },
  },

  // ── Entități principale ──
  product: {
    model: "product",
    module: "product",
    fields: {
      name: "string",
      subcategory: "string",
      unit: "string",
      pricePerUnit: "number",
      image: "string",
      sku: "string",
      supplier: "string",
    },
    afterSave: async (id, values) => {
      if (Array.isArray(values.categoryIds)) {
        await prisma.productOnCategory.deleteMany({ where: { productId: id } });
        await prisma.productOnCategory.createMany({
          data: (values.categoryIds as unknown[])
            .map((c) => parseInt(String(c), 10))
            .filter((n) => !isNaN(n))
            .map((categoryId) => ({ productId: id, categoryId })),
          skipDuplicates: true,
        });
      }
    },
  },
  company: {
    model: "company",
    module: "company",
    fields: {
      name: "string",
      adminName: "string",
      phone: "string",
      email: "string",
      idno: "string",
      vatCode: "string",
      iban: "string",
      bic: "string",
      bankName: "string",
      legalStreet: "string",
      legalCity: "string",
      legalZip: "string",
      officeStreet: "string",
      officeCity: "string",
      officeZip: "string",
      typeId: "int",
      size: "string",
      annualRevenue: "number",
      industryId: "int",
    },
  },
  contact: {
    model: "contact",
    module: "contact",
    softDelete: true,
    fields: {
      firstName: "string",
      lastName: "string",
      email: "string",
      phone: "string",
      idnp: "string",
      birthDate: "date",
      deliveryAddress: "string",
      homeAddress: "string",
      presentCountry: "string",
      staffId: "int",
      companyId: "int",
      stageId: "int",
      sourceId: "int",
      failureCauseId: "int",
      productionSequenceId: "int",
      nextAction: "string",
      nextActionDate: "date",
      comment: "string",
    },
    beforeSave: async (values, _userId, isCreate) => {
      // aceeași formă de telefon ca la lead-urile de pe site → deduplicarea prinde și „069…” vs „+373 69…”
      if ("phone" in values) values.phone = normalizePhone(String(values.phone ?? ""));
      if (isCreate) {
        // deduplicare după telefon [NOU]
        const phone = String(values.phone ?? "").trim();
        if (phone) {
          const dup = await prisma.contact.findFirst({
            where: { phone, deletedAt: null },
          });
          if (dup) {
            throw new Error(
              `Există deja un client cu acest telefon: ${dup.firstName} ${dup.lastName} (${dup.humanId})`
            );
          }
        }
        // persoană juridică: se leagă de compania cu același nume sau se creează una nouă
        const companyName = String(values.companyName ?? "").trim();
        if (values.clientType === "juridica" && companyName) {
          const idno = String(values.companyIdno ?? "").trim() || null;
          const existing = await prisma.company.findFirst({
            where: { name: { equals: companyName, mode: "insensitive" } },
          });
          const company = existing
            ? existing.idno || !idno
              ? existing
              : await prisma.company.update({ where: { id: existing.id }, data: { idno } })
            : await prisma.company.create({ data: { name: companyName, idno } });
          values.companyId = company.id;
        }
        const sourceId = values.sourceId ? Number(values.sourceId) : null;
        values.humanId = await generateHumanId(sourceId);
        if (!values.stageId) {
          const lead = await prisma.contactStage.findFirst({ where: { name: "Lead" } });
          if (lead) values.stageId = lead.id;
        }
      }
      return values;
    },
    afterSave: async (id, _values, _userId, isCreate) => {
      if (isCreate) {
        const contact = await prisma.contact.findUnique({ where: { id } });
        if (contact?.stageId) {
          await prisma.contactStageHistory.create({
            data: { contactId: id, stageId: contact.stageId },
          });
        }
      }
    },
  },
  room: {
    model: "room",
    module: "room",
    fields: { contactId: "int", roomTypeId: "int", name: "string" },
    beforeSave: async (values) => {
      if (values.roomTypeId && !values.name) {
        const rt = await prisma.roomType.findUnique({
          where: { id: Number(values.roomTypeId) },
        });
        if (rt) values.name = rt.name;
      }
      return values;
    },
  },
  opportunity: {
    model: "opportunity",
    module: "opportunity",
    softDelete: true,
    fields: {
      name: "string",
      roomId: "int",
      contactId: "int",
      staffId: "int",
      startDate: "date",
      closeDate: "date",
      deliveryDate: "date",
      description: "string",
      sinecost: "number",
      stageId: "int",
      typeId: "int",
      sourceId: "int",
      nextStep: "string",
      competitors: "string",
      productionSequenceId: "int",
    },
    beforeSave: async (values) => {
      if (values.roomId && !values.contactId) {
        const room = await prisma.room.findUnique({
          where: { id: Number(values.roomId) },
        });
        if (room) values.contactId = room.contactId;
      }
      return values;
    },
    afterSave: async (id, values, _userId, isCreate) => {
      if (isCreate && values.stageId) {
        await prisma.opportunityStageHistory.create({
          data: { opportunityId: id, stageId: Number(values.stageId) },
        });
      }
    },
  },
  note: {
    model: "note",
    module: "note",
    fields: {
      title: "string",
      body: "string",
      recipientId: "int",
      contactId: "int",
      companyId: "int",
      opportunityId: "int",
      quoteId: "int",
      taskId: "int",
    },
    beforeSave: async (values, userId, isCreate) => {
      if (isCreate) values.authorId = userId;
      return values;
    },
    afterSave: async (id, _values, _userId, isCreate) => {
      if (isCreate) await notifyNewMessage(id);
    },
  },
  attachment: {
    model: "attachment",
    module: "attachment",
    fields: {
      name: "string",
      filePath: "string",
      mime: "string",
      size: "int",
      type: "string",
      reportToId: "int",
      contactId: "int",
      companyId: "int",
      roomId: "int",
      opportunityId: "int",
      quoteId: "int",
    },
    beforeSave: async (values, userId, isCreate) => {
      if (isCreate) values.staffId = userId;
      // dacă atașamentul e legat de o cameră, leagă-l și de client
      if (values.roomId && !values.contactId) {
        const room = await prisma.room.findUnique({ where: { id: Number(values.roomId) } });
        if (room) values.contactId = room.contactId;
      }
      if (values.opportunityId && !values.contactId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: Number(values.opportunityId) },
        });
        if (opp?.contactId) values.contactId = opp.contactId;
      }
      return values;
    },
    afterSave: async (id, values, userId, isCreate) => {
      if (isCreate && values.reportToId && Number(values.reportToId) !== userId) {
        const author = await prisma.staff.findUnique({ where: { id: userId } });
        await notify(
          Number(values.reportToId),
          `${author?.firstName ?? ""} ${author?.lastName ?? ""} a încărcat atașamentul „${values.name}”.`,
          "/admin/attachment"
        );
      }
    },
  },
  task: {
    model: "task",
    module: "task",
    fields: {
      name: "string",
      description: "string",
      assigneeId: "int",
      typeId: "int",
      statusId: "int",
      priorityId: "int",
      opportunityId: "int",
      contactId: "int",
      dueDate: "date",
    },
    afterSave: async (id, values, userId, isCreate) => {
      if (isCreate && values.assigneeId && Number(values.assigneeId) !== userId) {
        await notify(
          Number(values.assigneeId),
          `Ți-a fost asignată sarcina „${values.name}”.`,
          `/admin/task/${id}`
        );
      }
    },
  },
  staff: {
    model: "staff",
    module: "staff",
    fields: {
      firstName: "string",
      lastName: "string",
      username: "string",
      email: "string",
      street: "string",
      city: "string",
      zipCode: "string",
      country: "string",
      joinDate: "date",
      leaveDate: "date",
      employeeId: "string",
      departmentId: "int",
      roleId: "int",
      designationId: "int",
      employmentStatusId: "int",
      shiftId: "int",
      active: "bool",
    },
    beforeSave: async (values) => {
      const pwd = values.password ? String(values.password) : "";
      delete values.password;
      if (pwd) values.passwordHash = await bcrypt.hash(pwd, 10);
      return values;
    },
  },
  // doar pentru ștergere din liste (crearea se face prin acțiuni dedicate)
  quote: {
    model: "quote",
    module: "quote",
    softDelete: true,
    fields: { stageId: "int", active: "bool", expirationDate: "date" },
  },
  contract: { model: "contract", module: "contract", fields: { status: "string" } },
  offer: { model: "offer", module: "offer", fields: {} },
  payment: {
    model: "payment",
    module: "finances",
    fields: {
      contractId: "int",
      date: "date",
      amountEur: "number",
      method: "string",
      note: "string",
    },
  },
};

export function coerce(kind: FieldKind, raw: unknown): unknown {
  if (raw === "" || raw === undefined || raw === null) return null;
  switch (kind) {
    case "string":
      return String(raw);
    case "number": {
      const n = parseFloat(String(raw).replace(",", "."));
      return isNaN(n) ? null : n;
    }
    case "int": {
      const n = parseInt(String(raw), 10);
      return isNaN(n) ? null : n;
    }
    case "date": {
      const d = new Date(String(raw));
      return isNaN(d.getTime()) ? null : d;
    }
    case "bool":
      return raw === true || raw === "true" || raw === "on" || raw === "1";
    case "stringArray":
      return Array.isArray(raw) ? raw.map(String) : [];
  }
}
