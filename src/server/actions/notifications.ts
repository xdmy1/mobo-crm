"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EMPTY } from "@/lib/format";
import { personName, contactLabel } from "@/lib/people";

export async function getMyNotifications(limit = 15) {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { staffId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { staffId: user.id, read: false } }),
  ]);
  return {
    items: items.map((n) => ({
      id: n.id,
      text: n.text,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
  };
}

export async function deleteNotification(id: number) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.deleteMany({ where: { id, staffId: user.id } });
  revalidatePath("/admin", "layout");
}

export async function markAllRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { staffId: user.id, read: false },
    data: { read: true },
  });
}

export async function markNotificationRead(id: number, read: boolean) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { id, staffId: user.id },
    data: { read },
  });
  revalidatePath("/admin/notifications");
}

/** Căutare globală (Ctrl+K) [NOU]. */
export async function globalSearch(q: string) {
  const user = await getCurrentUser();
  if (!user || !q.trim()) return [];
  const term = q.trim();
  const [contacts, opportunities, quotes, companies] = await Promise.all([
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { phone: { contains: term } },
          ...(/^#?\d+$/.test(term) ? [{ humanId: Number(term.replace("#", "")) }] : []),
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 6,
    }),
    prisma.opportunity.findMany({
      where: { deletedAt: null, name: { contains: term, mode: "insensitive" } },
      take: 5,
      include: { contact: true },
    }),
    prisma.quote.findMany({
      where: { deletedAt: null, name: { contains: term, mode: "insensitive" } },
      take: 5,
      include: { opportunity: { include: { contact: true } } },
    }),
    prisma.company.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      take: 4,
    }),
  ]);
  return [
    ...contacts.map((c) => ({
      kind: "Client",
      label: personName(c),
      sub: `#${c.humanId}${c.phone ? " · " + c.phone : ""}`,
      href: `/admin/contact/${c.id}`,
    })),
    ...opportunities.map((o) => ({
      kind: "Proiect",
      label: o.name,
      // clientul + ID-ul lui — ca două proiecte cu același nume să poată fi deosebite
      sub: o.contact ? contactLabel(o.contact) : EMPTY,
      href: `/admin/opportunity/${o.id}`,
    })),
    ...quotes.map((qt) => ({
      kind: "Estimare",
      label: qt.name,
      sub: qt.opportunity.contact
        ? `${contactLabel(qt.opportunity.contact)} · ${qt.opportunity.name}`
        : qt.opportunity.name,
      href: `/admin/quote/${qt.id}`,
    })),
    ...companies.map((co) => ({
      kind: "Pers. Juridică",
      label: co.name,
      sub: co.idno ?? "",
      href: `/admin/company/${co.id}`,
    })),
  ];
}
