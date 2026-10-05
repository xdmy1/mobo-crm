// Interogările listelor — partajate între pagini și /api/export.
// Toate paginate server-side, cu căutare și filtre din URL.

import { prisma } from "@/lib/db";
import { fmtDateTime, fmtDate, fmtLei, fmtEurLei, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { roomSum } from "@/lib/sums";
import {
  contactStageColor,
  opportunityStageColor,
  taskStatus,
  taskPriority,
  contractStatus,
} from "@/lib/status";
import type { Cell, ColumnDef, ListResult, RowData } from "@/lib/listTypes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ListParams {
  page?: string;
  pageSize?: string;
  q?: string;
  sort?: string;
  dir?: string;
  [key: string]: string | undefined;
}

function paging(params: ListParams, cap = 100000) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.min(cap, Math.max(1, parseInt(params.pageSize ?? "10", 10) || 10));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function fInt(params: ListParams, key: string): number[] {
  const v = params[`f_${key}`];
  if (!v) return [];
  return v.split(",").map((x) => parseInt(x, 10)).filter((n) => !isNaN(n));
}
function fStr(params: ListParams, key: string): string[] {
  const v = params[`f_${key}`];
  return v ? v.split(",") : [];
}
function inFilter(ids: number[]) {
  return ids.length ? { in: ids } : undefined;
}

const fullName = (p?: { firstName: string; lastName: string } | null) =>
  p ? personName(p) : null;

/** Celulă-link către client — aceeași formă în toate listele. */
const contactCell = (
  c?: { id: number; firstName: string; lastName: string; humanId?: string | null } | null
): Cell => (c ? { t: personName(c), href: `/admin/contact/${c.id}`, sub: c.humanId ?? undefined } : null);

/** Celulă-link către proiect. */
const opportunityCell = (o?: { id: number; name: string } | null): Cell =>
  o ? { t: o.name, href: `/admin/opportunity/${o.id}` } : null;

// ────────────────────────────────────────────────────────────────
// Nomenclatoare generice
// ────────────────────────────────────────────────────────────────

interface NomenSpec {
  model: string;
  columns: ColumnDef[];
  map: (row: any) => { cells: Record<string, Cell>; raw?: Record<string, unknown> };
  orderBy?: any;
  searchField?: string;
}

const dates = (row: any): Record<string, Cell> => ({
  createdAt: fmtDateTime(row.createdAt),
  updatedAt: fmtDateTime(row.updatedAt),
});

const nameSpec = (model: string): NomenSpec => ({
  model,
  columns: [
    { key: "name", label: "Nume", sortable: true },
    { key: "createdAt", label: "Data creării" },
    { key: "updatedAt", label: "Data actualizării" },
  ],
  map: (r) => ({ cells: { name: r.name, ...dates(r) }, raw: { name: r.name } }),
});

const NOMEN: Record<string, NomenSpec> = {
  failureCause: nameSpec("failureCause"),
  productionSequence: nameSpec("productionSequence"),
  opportunityType: nameSpec("opportunityType"),
  opportunitySource: nameSpec("opportunitySource"),
  quoteStage: nameSpec("quoteStage"),
  taskType: nameSpec("taskType"),
  taskStatus: nameSpec("taskStatus"),
  taskPriority: nameSpec("taskPriority"),
  companyType: nameSpec("companyType"),
  industry: nameSpec("industry"),
  department: nameSpec("department"),
  designation: nameSpec("designation"),
  employmentStatus: nameSpec("employmentStatus"),
  productCategory: nameSpec("productCategory"),
  contactSource: {
    model: "contactSource",
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "code", label: "Cod ID" },
      { key: "createdAt", label: "Data creării" },
      { key: "updatedAt", label: "Data actualizării" },
    ],
    map: (r) => ({
      cells: { name: r.name, code: r.code, ...dates(r) },
      raw: { name: r.name, code: r.code },
    }),
  },
  contactStage: {
    model: "contactStage",
    orderBy: { order: "asc" },
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "order", label: "Ordine" },
      { key: "rules", label: "Reguli tranziție" },
      { key: "createdAt", label: "Data creării" },
    ],
    map: (r) => {
      const rules: string[] = [];
      if (r.requireContract) rules.push("contract");
      if (r.require2D) rules.push("2D");
      if (r.require3D) rules.push("3D");
      if (r.requireFailureCause) rules.push("cauză eșec");
      if (r.notifyOnEnter) rules.push("notificare");
      return {
        cells: {
          name: r.name,
          order: r.order,
          rules: rules.length ? { t: rules.join(", "), badge: "blue" as const } : null,
          createdAt: fmtDateTime(r.createdAt),
        },
        raw: {
          name: r.name,
          order: r.order,
          requireContract: r.requireContract,
          require2D: r.require2D,
          require3D: r.require3D,
          requireFailureCause: r.requireFailureCause,
          notifyOnEnter: r.notifyOnEnter,
        },
      };
    },
  },
  opportunityStage: {
    model: "opportunityStage",
    orderBy: { order: "asc" },
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "order", label: "Ordine" },
      { key: "phase", label: "Fază" },
      { key: "createdAt", label: "Data creării" },
    ],
    map: (r) => ({
      cells: {
        name: r.name,
        order: r.order,
        phase: r.phase,
        createdAt: fmtDateTime(r.createdAt),
      },
      raw: { name: r.name, order: r.order, phase: r.phase },
    }),
  },
  roomType: {
    model: "roomType",
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "elements", label: "Elemente" },
      { key: "createdAt", label: "Data creării" },
      { key: "updatedAt", label: "Data actualizării" },
    ],
    map: (r) => ({
      cells: { name: r.name, elements: r.elements.join(", ") || EMPTY, ...dates(r) },
      raw: { name: r.name, elements: r.elements },
    }),
  },
  shift: {
    model: "shift",
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "startTime", label: "Început" },
      { key: "endTime", label: "Sfârșit" },
      { key: "createdAt", label: "Data creării" },
    ],
    map: (r) => ({
      cells: {
        name: r.name,
        startTime: r.startTime,
        endTime: r.endTime,
        createdAt: fmtDateTime(r.createdAt),
      },
      raw: { name: r.name, startTime: r.startTime, endTime: r.endTime },
    }),
  },
  announcement: {
    model: "announcement",
    searchField: "title",
    columns: [
      { key: "title", label: "Titlu", sortable: true },
      { key: "body", label: "Anunț" },
      { key: "date", label: "Data" },
    ],
    map: (r) => ({
      cells: { title: r.title, body: r.body, date: fmtDate(r.date) },
      raw: { title: r.title, body: r.body, date: r.date?.toISOString() },
    }),
  },
  award: {
    model: "award",
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "description", label: "Descriere" },
      { key: "date", label: "Data" },
    ],
    map: (r) => ({
      cells: { name: r.name, description: r.description, date: fmtDate(r.date) },
      raw: { name: r.name, description: r.description, date: r.date?.toISOString() },
    }),
  },
  partner: {
    model: "partner",
    columns: [
      { key: "name", label: "Nume", sortable: true },
      { key: "phone", label: "Număr de contact" },
      { key: "commissionPercent", label: "Comision %" },
      { key: "createdAt", label: "Data creării" },
    ],
    map: (r) => ({
      cells: {
        name: r.name,
        phone: r.phone,
        commissionPercent: r.commissionPercent,
        createdAt: fmtDateTime(r.createdAt),
      },
      raw: { name: r.name, phone: r.phone, commissionPercent: r.commissionPercent },
    }),
  },
  account: {
    model: "account",
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Account", sortable: true },
      { key: "type", label: "Tipul Account-ului" },
    ],
    map: (r) => ({
      cells: { id: r.id, name: r.name, type: { t: r.type, badge: "gray" as const } },
      raw: { name: r.name, type: r.type },
    }),
  },
};
NOMEN.designerPartner = { ...NOMEN.partner, model: "designerPartner" };

// ────────────────────────────────────────────────────────────────

export async function getList(
  entity: string,
  params: ListParams
): Promise<ListResult & { title?: string }> {
  const { page, pageSize, skip, take } = paging(params);
  const q = params.q?.trim();
  const dir = params.dir === "desc" ? "desc" : "asc";
  const sort = params.sort;

  // nomenclatoare generice
  const nomen = NOMEN[entity];
  if (nomen) {
    const searchField = nomen.searchField ?? "name";
    const where = q
      ? { [searchField]: { contains: q, mode: "insensitive" } }
      : undefined;
    const orderBy =
      sort === "name" || sort === "title"
        ? { [searchField]: dir }
        : nomen.orderBy ?? { id: "asc" };
    const m = (prisma as any)[nomen.model];
    const [rows, total] = await Promise.all([
      m.findMany({ where, orderBy, skip, take }),
      m.count({ where }),
    ]);
    return {
      columns: nomen.columns,
      rows: rows.map((r: any) => ({ id: r.id, ...nomen.map(r) })),
      total,
      page,
      pageSize,
    };
  }

  switch (entity) {
    case "contact": {
      const where: any = {
        deletedAt: null,
        stageId: inFilter(fInt(params, "stage")),
        sourceId: inFilter(fInt(params, "source")),
        staffId: inFilter(fInt(params, "staff")),
        companyId: inFilter(fInt(params, "company")),
      };
      if (q)
        where.OR = [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
          { humanId: { contains: q } },
        ];
      const orderBy =
        sort === "name"
          ? [{ firstName: dir }, { lastName: dir }]
          : { createdAt: "desc" as const };
      const [rows, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: orderBy as any,
          skip,
          take,
          include: { staff: true, stage: true, source: true },
        }),
        prisma.contact.count({ where }),
      ]);
      return {
        columns: [
          { key: "humanId", label: "ID" },
          { key: "name", label: "Nume", sortable: true },
          { key: "phone", label: "Număr de contact" },
          { key: "staff", label: "Responsabil" },
          { key: "stage", label: "Etapa" },
          { key: "source", label: "Sursă" },
          { key: "createdAt", label: "Data creării" },
          { key: "email", label: "Email" },
        ],
        rows: rows.map((c) => ({
          id: c.id,
          viewHref: `/admin/contact/${c.id}`,
          cells: {
            humanId: c.humanId,
            name: { t: personName(c), href: `/admin/contact/${c.id}` },
            phone: c.phone,
            staff: fullName(c.staff),
            stage: c.stage ? { t: c.stage.name, badge: contactStageColor(c.stage.name) } : null,
            source: c.source?.name ?? null,
            createdAt: fmtDateTime(c.createdAt),
            email: c.email,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "company": {
      const where: any = q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {};
      const [rows, total] = await Promise.all([
        prisma.company.findMany({
          where,
          orderBy: sort === "name" ? { name: dir } : { createdAt: "desc" },
          skip,
          take,
          include: { type: true, industry: true },
        }),
        prisma.company.count({ where }),
      ]);
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Număr de contact" },
          { key: "adminName", label: "Administrator" },
          { key: "type", label: "Tip" },
          { key: "size", label: "Mărimea" },
          { key: "annualRevenue", label: "Venituri anuale" },
          { key: "industry", label: "Industrie" },
        ],
        rows: rows.map((c) => ({
          id: c.id,
          viewHref: `/admin/company/${c.id}`,
          cells: {
            name: { t: c.name, href: `/admin/company/${c.id}` },
            email: c.email,
            phone: c.phone,
            adminName: c.adminName,
            type: c.type?.name ?? null,
            size: c.size,
            annualRevenue: c.annualRevenue != null ? fmtLei(c.annualRevenue) : null,
            industry: c.industry?.name ?? null,
          },
          raw: {
            name: c.name, adminName: c.adminName, phone: c.phone, email: c.email,
            idno: c.idno, vatCode: c.vatCode, iban: c.iban, bic: c.bic, bankName: c.bankName,
            legalStreet: c.legalStreet, legalCity: c.legalCity, legalZip: c.legalZip,
            officeStreet: c.officeStreet, officeCity: c.officeCity, officeZip: c.officeZip,
            typeId: c.typeId ? String(c.typeId) : null,
            industryId: c.industryId ? String(c.industryId) : null,
            size: c.size, annualRevenue: c.annualRevenue,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "opportunity": {
      const where: any = {
        deletedAt: null,
        stageId: inFilter(fInt(params, "stage")),
        contactId: inFilter(fInt(params, "contact")),
        staffId: inFilter(fInt(params, "staff")),
        typeId: inFilter(fInt(params, "type")),
        sourceId: inFilter(fInt(params, "source")),
      };
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          orderBy: sort === "name" ? { name: dir } : { createdAt: "desc" },
          skip,
          take,
          include: { staff: true, stage: true, type: true, source: true, contact: true },
        }),
        prisma.opportunity.count({ where }),
      ]);
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "contact", label: "Client" },
          { key: "staff", label: "Responsabil" },
          { key: "sinecost", label: "Sinecost" },
          { key: "stage", label: "Etapa" },
          { key: "type", label: "Tip" },
          { key: "source", label: "Sursă" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((o) => ({
          id: o.id,
          viewHref: `/admin/opportunity/${o.id}`,
          cells: {
            name: { t: o.name, href: `/admin/opportunity/${o.id}` },
            contact: contactCell(o.contact),
            staff: fullName(o.staff),
            sinecost: o.sinecost != null ? fmtLei(o.sinecost) : null,
            stage: o.stage ? { t: o.stage.name, badge: opportunityStageColor(o.stage.name) } : null,
            type: o.type?.name ?? null,
            source: o.source?.name ?? null,
            createdAt: fmtDateTime(o.createdAt),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "quote": {
      const active = fStr(params, "active")[0];
      const where: any = {
        deletedAt: null,
        stageId: inFilter(fInt(params, "stage")),
        opportunityId: inFilter(fInt(params, "opportunity")),
      };
      const contactIds = fInt(params, "contact");
      if (contactIds.length) where.opportunity = { contactId: { in: contactIds } };
      const companyIds = fInt(params, "company");
      if (companyIds.length)
        where.opportunity = {
          ...(where.opportunity ?? {}),
          contact: { companyId: { in: companyIds } },
        };
      if (active === "true") where.active = true;
      if (active === "false") where.active = false;
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.quote.findMany({
          where,
          orderBy: sort === "name" ? { name: dir } : { createdAt: "desc" },
          skip,
          take,
          include: {
            staff: true,
            opportunity: { include: { contact: { include: { company: true } } } },
          },
        }),
        prisma.quote.count({ where }),
      ]);
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "contact", label: "Client" },
          { key: "opportunity", label: "Proiect" },
          { key: "staff", label: "Responsabil" },
          { key: "quoteDate", label: "Data estimării" },
          { key: "expirationDate", label: "Data expirării" },
          { key: "totalPrice", label: "Preț total" },
          { key: "active", label: "Stare" },
          { key: "company", label: "Persoană juridică" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((qt) => ({
          id: qt.id,
          viewHref: `/admin/quote/${qt.id}`,
          cells: {
            name: { t: qt.name, href: `/admin/quote/${qt.id}` },
            contact: contactCell(qt.opportunity.contact),
            opportunity: opportunityCell(qt.opportunity),
            staff: fullName(qt.staff),
            quoteDate: fmtDate(qt.quoteDate),
            expirationDate: fmtDate(qt.expirationDate),
            // valoarea stocată a estimării — nu se recalculează la cursul de azi
            totalPrice: fmtLei(qt.totalPrice),
            active: qt.active ? { t: "Activă", badge: "green" } : { t: "Inactivă", badge: "gray" },
            company: qt.opportunity.contact?.company?.name ?? null,
            createdAt: fmtDateTime(qt.createdAt),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "product": {
      const where: any = {};
      const catIds = fInt(params, "category");
      if (catIds.length) where.categories = { some: { categoryId: { in: catIds } } };
      const subs = fStr(params, "subcategory");
      if (subs.length) where.subcategory = { in: subs };
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: sort === "name" ? { name: dir } : { id: "asc" },
          skip,
          take,
          include: { categories: { include: { category: true } } },
        }),
        prisma.product.count({ where }),
      ]);
      const unitLabel = { M2: "M2", ML: "M/L", BUC: "Bucată" } as const;
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "categories", label: "Categorii" },
          { key: "unit", label: "Unitate de măsură" },
          { key: "pricePerUnit", label: "Preț per unitate" },
          { key: "createdAt", label: "Data creării" },
          { key: "updatedAt", label: "Data actualizării" },
        ],
        rows: rows.map((p) => ({
          id: p.id,
          cells: {
            name: p.name,
            categories: p.categories.map((c) => c.category.name).join(", "),
            unit: unitLabel[p.unit],
            pricePerUnit: fmtLei(p.pricePerUnit),
            createdAt: fmtDateTime(p.createdAt),
            updatedAt: fmtDateTime(p.updatedAt),
          },
          raw: {
            name: p.name,
            subcategory: p.subcategory,
            unit: p.unit,
            pricePerUnit: p.pricePerUnit,
            categoryIds: p.categories.map((c) => String(c.categoryId)),
            image: p.image,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "contract": {
      const where: any = {};
      const fn = params.f_firstName?.trim();
      const ln = params.f_lastName?.trim();
      if (fn) where.contact = { firstName: { contains: fn, mode: "insensitive" } };
      if (ln)
        where.contact = {
          ...(where.contact ?? {}),
          lastName: { contains: ln, mode: "insensitive" },
        };
      if (q)
        where.OR = [
          { fileName: { contains: q, mode: "insensitive" } },
          { contact: { firstName: { contains: q, mode: "insensitive" } } },
          { contact: { lastName: { contains: q, mode: "insensitive" } } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ];
      const [rows, total] = await Promise.all([
        prisma.contract.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            contact: true,
            company: true,
            opportunities: { include: { opportunity: true } },
          },
        }),
        prisma.contract.count({ where }),
      ]);
      const kindLabel = { CLIENT: "Client", COMPANY: "Persoană Juridică", HANDOVER: "Predat/Preluat" };
      return {
        columns: [
          { key: "fileName", label: "Denumire" },
          { key: "person", label: "Client" },
          { key: "kind", label: "Tip contract" },
          { key: "status", label: "Status" },
          { key: "projects", label: "Proiecte" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((c) => {
          const st = contractStatus(c.status);
          return {
            id: c.id,
            downloadHref: c.filePath ? `/api/files/${encodeURIComponent(c.filePath)}?download=1` : undefined,
            cells: {
              fileName: c.fileName,
              person: c.contact
                ? contactCell(c.contact)
                : c.company
                  ? { t: c.company.name, href: `/admin/company/${c.company.id}` }
                  : null,
              kind: { t: kindLabel[c.kind], badge: c.kind === "HANDOVER" ? "amber" : "blue" },
              status: st ? { t: st.label, badge: st.color } : null,
              projects: c.opportunities.map((o) => o.opportunity.name).join(", ") || EMPTY,
              createdAt: fmtDateTime(c.createdAt),
            },
          } satisfies RowData;
        }),
        total,
        page,
        pageSize,
      };
    }

    case "offer": {
      const where: any = {};
      const fn = params.f_firstName?.trim();
      const ln = params.f_lastName?.trim();
      if (fn) where.contact = { firstName: { contains: fn, mode: "insensitive" } };
      if (ln)
        where.contact = {
          ...(where.contact ?? {}),
          lastName: { contains: ln, mode: "insensitive" },
        };
      if (q) where.fileName = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: { contact: true },
        }),
        prisma.offer.count({ where }),
      ]);
      return {
        columns: [
          { key: "fileName", label: "Denumire" },
          { key: "person", label: "Client" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((o) => ({
          id: o.id,
          downloadHref: o.filePath ? `/api/files/${encodeURIComponent(o.filePath)}?download=1` : undefined,
          cells: {
            fileName: o.fileName,
            person: contactCell(o.contact),
            createdAt: fmtDateTime(o.createdAt),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "note": {
      const where: any = {
        contactId: inFilter(fInt(params, "contact")),
        companyId: inFilter(fInt(params, "company")),
        opportunityId: inFilter(fInt(params, "opportunity")),
        quoteId: inFilter(fInt(params, "quote")),
      };
      if (q)
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
        ];
      const [rows, total] = await Promise.all([
        prisma.note.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            author: true,
            recipient: true,
            contact: true,
            company: true,
            opportunity: true,
            quote: true,
          },
        }),
        prisma.note.count({ where }),
      ]);
      return {
        columns: [
          { key: "title", label: "Titlu", sortable: true },
          { key: "author", label: "Autor" },
          { key: "recipient", label: "Destinatar" },
          { key: "read", label: "Citit" },
          { key: "company", label: "Persoană juridică" },
          { key: "contact", label: "Client" },
          { key: "opportunity", label: "Proiect" },
          { key: "quote", label: "Estimare" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((n) => ({
          id: n.id,
          cells: {
            title: n.title,
            author: fullName(n.author),
            recipient: fullName(n.recipient),
            read: n.recipientId
              ? n.readAt
                ? { t: `Citit ${fmtDateTime(n.readAt)}`, badge: "green" }
                : { t: "Necitit", badge: "amber" }
              : null,
            company: n.company?.name ?? null,
            contact: contactCell(n.contact),
            opportunity: opportunityCell(n.opportunity),
            quote: n.quote ? { t: n.quote.name, href: `/admin/quote/${n.quote.id}` } : null,
            createdAt: fmtDateTime(n.createdAt),
          },
          raw: {
            title: n.title,
            body: n.body,
            recipientId: n.recipientId ? String(n.recipientId) : null,
            contactId: n.contactId ? String(n.contactId) : null,
            companyId: n.companyId ? String(n.companyId) : null,
            opportunityId: n.opportunityId ? String(n.opportunityId) : null,
            quoteId: n.quoteId ? String(n.quoteId) : null,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "attachment": {
      const where: any = {
        contactId: inFilter(fInt(params, "contact")),
        companyId: inFilter(fInt(params, "company")),
        opportunityId: inFilter(fInt(params, "opportunity")),
        quoteId: inFilter(fInt(params, "quote")),
      };
      const types = fStr(params, "type");
      if (types.length) where.type = { in: types };
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.attachment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            staff: true,
            contact: true,
            company: true,
            opportunity: true,
            quote: true,
          },
        }),
        prisma.attachment.count({ where }),
      ]);
      const typeLabels: Record<string, string> = {
        ATASAMENT: "Atașament",
        PROIECT2D: "Proiect2D",
        PROIECT3D: "Proiect3D",
        CONTRACT: "Contract",
        OFERTA: "Ofertă",
        MASURARI: "Măsurări",
      };
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "staff", label: "Responsabil" },
          { key: "type", label: "Tipul atașamentului" },
          { key: "company", label: "Persoană juridică" },
          { key: "contact", label: "Client" },
          { key: "opportunity", label: "Proiect" },
          { key: "quote", label: "Estimare" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((a) => ({
          id: a.id,
          downloadHref: `/api/files/${encodeURIComponent(a.filePath)}?download=1`,
          cells: {
            name: a.name,
            staff: fullName(a.staff),
            type: { t: typeLabels[a.type] ?? a.type, badge: a.type === "ATASAMENT" ? "gray" : "blue" },
            company: a.company?.name ?? null,
            contact: contactCell(a.contact),
            opportunity: opportunityCell(a.opportunity),
            quote: a.quote ? { t: a.quote.name, href: `/admin/quote/${a.quote.id}` } : null,
            createdAt: fmtDateTime(a.createdAt),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "task": {
      const where: any = {
        statusId: inFilter(fInt(params, "status")),
        priorityId: inFilter(fInt(params, "priority")),
        assigneeId: inFilter(fInt(params, "assignee")),
      };
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [rows, total] = await Promise.all([
        prisma.task.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            assignee: true,
            type: true,
            status: true,
            priority: true,
            contact: true,
            opportunity: true,
            _count: { select: { notes: true } },
          },
        }),
        prisma.task.count({ where }),
      ]);
      // nomenclatoarele sunt în engleză în DB — eticheta RO + culoarea vin din lib/status
      const badgeCell = (s: ReturnType<typeof taskStatus>): Cell =>
        s ? { t: s.label, badge: s.color } : null;
      return {
        columns: [
          { key: "name", label: "Nume", sortable: true },
          { key: "priority", label: "Prioritate" },
          { key: "status", label: "Statusul" },
          { key: "type", label: "Tip" },
          { key: "contact", label: "Client" },
          { key: "opportunity", label: "Proiect" },
          { key: "assignee", label: "Responsabil" },
          { key: "dueDate", label: "Termen" },
          { key: "messages", label: "Mesaje" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((t) => ({
          id: t.id,
          viewHref: `/admin/task/${t.id}`,
          cells: {
            name: { t: t.name, href: `/admin/task/${t.id}` },
            priority: badgeCell(taskPriority(t.priority?.name)),
            status: badgeCell(taskStatus(t.status?.name)),
            type: t.type?.name ?? null,
            contact: contactCell(t.contact),
            opportunity: opportunityCell(t.opportunity),
            assignee: fullName(t.assignee),
            dueDate: fmtDate(t.dueDate),
            messages: t._count.notes,
            createdAt: fmtDateTime(t.createdAt),
          },
          raw: {
            name: t.name,
            description: t.description,
            assigneeId: t.assigneeId ? String(t.assigneeId) : null,
            typeId: t.typeId ? String(t.typeId) : null,
            statusId: t.statusId ? String(t.statusId) : null,
            priorityId: t.priorityId ? String(t.priorityId) : null,
            opportunityId: t.opportunityId ? String(t.opportunityId) : null,
            contactId: t.contactId ? String(t.contactId) : null,
            dueDate: t.dueDate?.toISOString(),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "email": {
      const where: any = {
        contactId: inFilter(fInt(params, "contact")),
        companyId: inFilter(fInt(params, "company")),
      };
      if (q)
        where.OR = [
          { subject: { contains: q, mode: "insensitive" } },
          { to: { contains: q, mode: "insensitive" } },
        ];
      const [rows, total] = await Promise.all([
        prisma.email.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: { staff: true, contact: true, company: true, opportunity: true, quote: true },
        }),
        prisma.email.count({ where }),
      ]);
      return {
        columns: [
          { key: "subject", label: "Subiect", sortable: true },
          { key: "to", label: "Destinatar" },
          { key: "staff", label: "Responsabil" },
          { key: "company", label: "Persoană juridică" },
          { key: "contact", label: "Client" },
          { key: "opportunity", label: "Proiect" },
          { key: "status", label: "Statusul" },
          { key: "createdAt", label: "Data creării" },
        ],
        rows: rows.map((e) => ({
          id: e.id,
          cells: {
            subject: e.subject,
            to: e.to,
            staff: fullName(e.staff),
            company: e.company?.name ?? null,
            contact: contactCell(e.contact),
            opportunity: opportunityCell(e.opportunity),
            status: {
              t: e.status === "TRIMIS" ? "Trimis" : e.status === "ESUAT" ? "Eșuat" : "Programat",
              badge: e.status === "TRIMIS" ? "green" : e.status === "ESUAT" ? "red" : "amber",
            },
            createdAt: fmtDateTime(e.createdAt),
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "staff": {
      const where: any = q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};
      const [rows, total] = await Promise.all([
        prisma.staff.findMany({
          where,
          orderBy: { id: "asc" },
          skip,
          take,
          include: { role: true, department: true },
        }),
        prisma.staff.count({ where }),
      ]);
      return {
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Nume", sortable: true },
          { key: "username", label: "Utilizator" },
          { key: "email", label: "Email" },
          { key: "role", label: "Rol" },
          { key: "department", label: "Departament" },
          { key: "active", label: "Activ" },
          { key: "twoFactor", label: "2FA" },
        ],
        rows: rows.map((s) => ({
          id: s.id,
          cells: {
            id: s.id,
            name: personName(s),
            username: s.username,
            email: s.email,
            role: s.role?.name ?? null,
            department: s.department?.name ?? null,
            active: s.active ? { t: "Activ", badge: "green" } : { t: "Inactiv", badge: "red" },
            twoFactor: s.totpEnabledAt ? { t: "Activ", badge: "green" } : { t: "Neconfigurat", badge: "gray" },
          },
          raw: {
            firstName: s.firstName,
            lastName: s.lastName,
            username: s.username,
            email: s.email,
            street: s.street, city: s.city, zipCode: s.zipCode, country: s.country,
            joinDate: s.joinDate?.toISOString(),
            leaveDate: s.leaveDate?.toISOString(),
            employeeId: s.employeeId,
            departmentId: s.departmentId ? String(s.departmentId) : null,
            roleId: s.roleId ? String(s.roleId) : null,
            designationId: s.designationId ? String(s.designationId) : null,
            employmentStatusId: s.employmentStatusId ? String(s.employmentStatusId) : null,
            shiftId: s.shiftId ? String(s.shiftId) : null,
            active: s.active,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "transaction": {
      const where: any = q ? { description: { contains: q, mode: "insensitive" } } : {};
      const [rows, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { date: "desc" },
          skip,
          take,
          include: { debitAccount: true, creditAccount: true, contract: true },
        }),
        prisma.transaction.count({ where }),
      ]);
      return {
        columns: [
          { key: "date", label: "Data" },
          { key: "debit", label: "Cont debit" },
          { key: "credit", label: "Cont credit" },
          { key: "amount", label: "Sumă" },
          { key: "description", label: "Descriere" },
          { key: "contract", label: "Contract" },
        ],
        rows: rows.map((t) => ({
          id: t.id,
          cells: {
            date: fmtDate(t.date),
            debit: t.debitAccount.name,
            credit: t.creditAccount.name,
            amount: fmtLei(t.amount),
            description: t.description,
            contract: t.contract ? `#${t.contract.number}` : null,
          },
          raw: {
            date: t.date.toISOString(),
            debitAccountId: String(t.debitAccountId),
            creditAccountId: String(t.creditAccountId),
            amount: t.amount,
            description: t.description,
            contractId: t.contractId ? String(t.contractId) : null,
          },
        })),
        total,
        page,
        pageSize,
      };
    }

    case "room": {
      // folosit pe pagina clientului
      const contactId = parseInt(params.f_contactId ?? "0", 10);
      const where: any = contactId ? { contactId } : {};
      const [rows, total] = await Promise.all([
        prisma.room.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
        prisma.room.count({ where }),
      ]);
      return {
        columns: [
          { key: "name", label: "Nume cameră", sortable: true },
          { key: "sum", label: "Sumă", sortable: true },
          { key: "createdAt", label: "Data creării" },
          { key: "updatedAt", label: "Data actualizării" },
        ],
        rows: await Promise.all(
          rows.map(async (r) => {
            // doar estimările care contează (active, neșterse) — aceeași regulă ca în pagina camerei
            const { eur, lei } = await roomSum(r.id);
            return {
              id: r.id,
              viewHref: `/admin/room/${r.id}`,
              cells: {
                name: { t: r.name, href: `/admin/room/${r.id}` },
                sum: fmtEurLei(eur, lei),
                createdAt: fmtDateTime(r.createdAt),
                updatedAt: fmtDateTime(r.updatedAt),
              },
              raw: { name: r.name, roomTypeId: r.roomTypeId ? String(r.roomTypeId) : null, contactId: String(r.contactId) },
            } satisfies RowData;
          })
        ),
        total,
        page,
        pageSize,
      };
    }

    default:
      throw new Error(`Listă necunoscută: ${entity}`);
  }
}
