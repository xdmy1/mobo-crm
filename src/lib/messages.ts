// Mesajele interne (Note) cu destinatar: unde trăiesc, cum anunțăm destinatarul.
// Cerința: „să nu fie scăpare, e important” — notificare în aplicație + push + email (dacă e configurat),
// iar în aplicație mesajul stă pe ecran până când destinatarul confirmă că l-a citit (Note.readAt).

import { prisma } from "./db";
import { notify } from "./notify";
import { sendEmail } from "./mail";
import { personName } from "./people";
import { EMPTY, fmtDateTime, ymdChisinau } from "./format";

type NoteContext = {
  contactId: number | null;
  opportunityId: number | null;
  taskId: number | null;
  quoteId: number | null;
  companyId: number | null;
  contact?: { firstName: string; lastName: string } | null;
  opportunity?: { name: string } | null;
  task?: { name: string } | null;
  quote?: { name: string } | null;
  company?: { name: string } | null;
};

export const NOTE_CONTEXT_INCLUDE = {
  contact: { select: { firstName: true, lastName: true } },
  opportunity: { select: { name: true } },
  task: { select: { name: true } },
  quote: { select: { name: true } },
  company: { select: { name: true } },
} as const;

/** Pagina pe care stă mesajul — acolo duce notificarea, nu în lista generală. */
export function noteLink(n: NoteContext): string {
  if (n.contactId) return `/admin/contact/${n.contactId}`;
  if (n.opportunityId) return `/admin/opportunity/${n.opportunityId}`;
  if (n.taskId) return `/admin/task/${n.taskId}`;
  if (n.quoteId) return `/admin/quote/${n.quoteId}`;
  if (n.companyId) return `/admin/company/${n.companyId}`;
  return "/admin/note";
}

/** „Client Liuda Rusescu”, „Proiect Bucătărie Iurii”… — despre ce e mesajul. */
export function noteWhere(n: NoteContext): string | null {
  if (n.contact) return `Client ${personName(n.contact)}`;
  if (n.opportunity) return `Proiect ${n.opportunity.name}`;
  if (n.task) return `Sarcină ${n.task.name}`;
  if (n.quote) return `Estimare ${n.quote.name}`;
  if (n.company) return n.company.name;
  return null;
}

/** Celula „Citit” din tabelele de mesaje: autorul vede dacă destinatarul a confirmat. */
export function noteReadCell(n: { recipientId: number | null; readAt: Date | null }): {
  text: string;
  badge?: "green" | "amber";
} {
  if (!n.recipientId) return { text: EMPTY };
  if (!n.readAt) return { text: "Necitit", badge: "amber" };
  // scurt, ca tabelul să încapă: ora dacă e de azi, altfel ziua
  const full = fmtDateTime(n.readAt); // „05/10/2026 14:39”
  const today = ymdChisinau(n.readAt) === ymdChisinau();
  return { text: `Citit ${today ? full.slice(-5) : full.slice(0, 5)}`, badge: "green" };
}

function appUrl(): string | null {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return base ? base.replace(/\/$/, "") : null;
}

/** Anunță destinatarul unui mesaj nou: notificare + push, apoi email dacă SMTP-ul și adresa există. */
export async function notifyNewMessage(noteId: number): Promise<void> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { author: true, recipient: true, ...NOTE_CONTEXT_INCLUDE },
  });
  if (!note?.recipientId || note.recipientId === note.authorId) return;

  const author = note.author ? personName(note.author) : "un coleg";
  const where = noteWhere(note);
  const link = noteLink(note);
  await notify(note.recipientId, `Mesaj de la ${author}: „${note.title}”${where ? ` · ${where}` : ""}`, link);

  const to = note.recipient?.email?.trim();
  if (!to) return;
  const url = appUrl();
  const body = [
    `${author} ți-a scris în MOBO CRM${where ? ` (${where})` : ""}:`,
    "",
    note.title,
    note.body ?? "",
    "",
    url ? `Deschide: ${url}${link}` : "",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
  // emailul e un plus: un SMTP lent sau neconfigurat nu are voie să blocheze salvarea mesajului
  await Promise.race([
    sendEmail(to, `Mesaj nou de la ${author}: ${note.title}`, body).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
}
