"use server";

// Mesajele necitite ale utilizatorului curent — alerta care stă pe ecran până la „Am citit” (MessageAlert).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { personName } from "@/lib/people";
import { NOTE_CONTEXT_INCLUDE, noteLink, noteWhere } from "@/lib/messages";

export interface UnreadMessage {
  id: number;
  title: string;
  body: string | null;
  author: string;
  where: string | null;
  link: string;
  createdAt: string;
}

// mesajele de dinainte de confirmarea de citire n-au readAt; nu le aruncăm pe toate deodată pe ecran
const ALERT_WINDOW_MS = 14 * 86_400_000;

export async function getUnreadMessages(): Promise<{ items: UnreadMessage[]; total: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], total: 0 };
  const where = {
    recipientId: user.id,
    readAt: null,
    createdAt: { gte: new Date(Date.now() - ALERT_WINDOW_MS) },
    OR: [{ authorId: null }, { authorId: { not: user.id } }],
  };
  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: true, ...NOTE_CONTEXT_INCLUDE },
    }),
    prisma.note.count({ where }),
  ]);
  return {
    total,
    items: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      author: n.author ? personName(n.author) : "Un coleg",
      where: noteWhere(n),
      link: noteLink(n),
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** Destinatarul confirmă că a citit — autorul vede „Citit” în lista de mesaje. */
export async function markMessageRead(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const res = await prisma.note.updateMany({
    where: { id, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (res.count) revalidatePath("/admin", "layout");
}
