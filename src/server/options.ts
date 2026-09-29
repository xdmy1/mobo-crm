// Opțiuni pentru select-uri (server-side), serializabile către client.

import { prisma } from "@/lib/db";
import type { SelectOption } from "@/lib/listTypes";
import { personName, contactLabel } from "@/lib/people";
import { taskStatus, taskPriority } from "@/lib/status";

const toOpt = (rows: Array<{ id: number; name: string }>): SelectOption[] =>
  rows.map((r) => ({ value: String(r.id), label: r.name }));

export async function staffOptions(): Promise<SelectOption[]> {
  const rows = await prisma.staff.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });
  return rows.map((s) => ({
    value: String(s.id),
    label: personName(s),
  }));
}

export async function contactStageOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.contactStage.findMany({ orderBy: { order: "asc" } }));
}

export async function contactSourceOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.contactSource.findMany({ orderBy: { id: "asc" } }));
}

export async function failureCauseOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.failureCause.findMany({ orderBy: { id: "asc" } }));
}

export async function productionSequenceOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.productionSequence.findMany({ orderBy: { id: "asc" } }));
}

export async function roomTypeOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.roomType.findMany({ orderBy: { id: "asc" } }));
}

export async function opportunityStageOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.opportunityStage.findMany({ orderBy: { order: "asc" } }));
}

export async function opportunityTypeOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.opportunityType.findMany({ orderBy: { id: "asc" } }));
}

export async function opportunitySourceOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.opportunitySource.findMany({ orderBy: { id: "asc" } }));
}

export async function quoteStageOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.quoteStage.findMany({ orderBy: { id: "asc" } }));
}

export async function companyOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.company.findMany({ orderBy: { name: "asc" } }));
}

export async function companyTypeOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.companyType.findMany({ orderBy: { id: "asc" } }));
}

export async function industryOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.industry.findMany({ orderBy: { id: "asc" } }));
}

export async function contactOptions(): Promise<SelectOption[]> {
  const rows = await prisma.contact.findMany({
    where: { deletedAt: null },
    orderBy: { id: "desc" },
    select: { id: true, firstName: true, lastName: true, humanId: true },
  });
  return rows.map((c) => ({
    value: String(c.id),
    label: contactLabel(c),
  }));
}

export async function roomOptions(contactId?: number): Promise<SelectOption[]> {
  const rows = await prisma.room.findMany({
    where: contactId ? { contactId } : undefined,
    orderBy: { id: "desc" },
    include: { contact: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((r) => ({
    value: String(r.id),
    label: contactId
      ? r.name
      : `${personName(r.contact)} — ${r.name}`,
  }));
}

export async function opportunityOptions(contactId?: number): Promise<SelectOption[]> {
  const rows = await prisma.opportunity.findMany({
    where: { deletedAt: null, ...(contactId ? { contactId } : {}) },
    orderBy: { id: "desc" },
    include: { contact: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((o) => ({
    value: String(o.id),
    label: contactId
      ? o.name
      : `${o.name}${o.contact ? ` — ${personName(o.contact)}` : ""}`,
  }));
}

export async function quoteOptions(): Promise<SelectOption[]> {
  const rows = await prisma.quote.findMany({
    where: { deletedAt: null },
    orderBy: { id: "desc" },
    select: { id: true, name: true },
    take: 300,
  });
  return toOpt(rows);
}

export async function taskTypeOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.taskType.findMany({ orderBy: { id: "asc" } }));
}
// Valorile din DB sunt în engleză (todo / in progress / done, low / medium / high) —
// în select-uri și filtre apare aceeași etichetă RO ca în liste și pe pagina sarcinii.
export async function taskStatusOptions(): Promise<SelectOption[]> {
  const rows = await prisma.taskStatus.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({ value: String(r.id), label: taskStatus(r.name)?.label ?? r.name }));
}
export async function taskPriorityOptions(): Promise<SelectOption[]> {
  const rows = await prisma.taskPriority.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({ value: String(r.id), label: taskPriority(r.name)?.label ?? r.name }));
}

export async function productCategoryOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.productCategory.findMany({ orderBy: { id: "asc" } }));
}

export async function departmentOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.department.findMany({ orderBy: { id: "asc" } }));
}
export async function designationOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.designation.findMany({ orderBy: { id: "asc" } }));
}
export async function employmentStatusOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.employmentStatus.findMany({ orderBy: { id: "asc" } }));
}
export async function shiftOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.shift.findMany({ orderBy: { id: "asc" } }));
}
export async function roleOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.role.findMany({ orderBy: { id: "asc" } }));
}
export async function accountOptions(): Promise<SelectOption[]> {
  return toOpt(await prisma.account.findMany({ orderBy: { id: "asc" } }));
}
export async function contractOptions(): Promise<SelectOption[]> {
  const rows = await prisma.contract.findMany({
    orderBy: { id: "desc" },
    include: { contact: true, company: true },
    take: 300,
  });
  return rows.map((c) => ({
    value: String(c.id),
    label: `#${c.number} — ${c.contact ? personName(c.contact) : c.company?.name ?? c.fileName}`,
  }));
}
