import { prisma } from "@/lib/db";
import type { SelectOption } from "@/lib/listTypes";
import { contactLabel } from "@/lib/people";

export interface ScopedOption extends SelectOption {
  contactId: number | null;
}

export interface DocOptions {
  contacts: SelectOption[];
  companies: SelectOption[];
  rooms: ScopedOption[];
  opportunities: ScopedOption[];
}

/** Opțiuni pentru drawerele de documente (contract / predat-preluat / ofertă). */
export async function getDocOptions(contactId?: number): Promise<DocOptions> {
  const [contacts, companies, rooms, opportunities] = await Promise.all([
    prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { id: "desc" },
      select: { id: true, firstName: true, lastName: true, humanId: true },
    }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.room.findMany({
      where: contactId ? { contactId } : undefined,
      orderBy: { id: "desc" },
    }),
    prisma.opportunity.findMany({
      where: { deletedAt: null, ...(contactId ? { contactId } : {}) },
      orderBy: { id: "desc" },
    }),
  ]);
  return {
    contacts: contacts.map((c) => ({
      value: String(c.id),
      label: contactLabel(c),
    })),
    companies: companies.map((c) => ({ value: String(c.id), label: c.name })),
    rooms: rooms.map((r) => ({
      value: String(r.id),
      label: r.name,
      contactId: r.contactId,
    })),
    opportunities: opportunities.map((o) => ({
      value: String(o.id),
      label: o.name,
      contactId: o.contactId,
    })),
  };
}
