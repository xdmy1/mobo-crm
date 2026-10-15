/**
 * Partea pură a integrării Meta: citește ce trimite webhook-ul / Graph API și o traduce în
 * ceva pe care CRM-ul îl înțelege. Fără baza de date, fără rețea — testată în parse.test.ts.
 */
import { normalizePhone } from "@/lib/phone";

export type MetaPlatformName = "facebook" | "instagram";

// ─────────────────────────── formulare instant (Lead Ads) ───────────────────────────

/** un răspuns din `field_data` al unui lead: `{ name: "phone_number", values: ["069..."] }` */
export interface LeadgenField {
  name?: string;
  values?: Array<string | null | undefined>;
}

/** o întrebare din definiția formularului (`GET /{form_id}?fields=questions`): cheie, etichetă, tip */
export interface FormQuestion {
  key?: string;
  label?: string;
  /** FIRST_NAME, LAST_NAME, FULL_NAME, PHONE, EMAIL, CUSTOM, … */
  type?: string;
}

/** un răspuns la o întrebare a formularului, cu textul întrebării așa cum l-a văzut clientul */
export interface LeadAnswer {
  key: string;
  question: string;
  answer: string;
}

export interface ParsedLeadgen {
  firstName: string;
  lastName: string;
  /** în forma canonică din CRM (+373…) */
  phone: string | null;
  email: string | null;
  /** răspunsul la „Ce tip de mobilă căutați?” (sau orice întrebare cu „tip”), dacă există */
  furnitureType: string | null;
  /** răspunsul la întrebarea despre buget, dacă există */
  budget: string | null;
  /** toate răspunsurile la întrebările custom, în ordinea formularului */
  answers: LeadAnswer[];
}

/** cheia întrebării fără diacritice și cu litere mici: „Ce buget aveți?” → „ce buget aveti?” */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

type Role = "first" | "last" | "full" | "phone" | "email" | "custom";

/** rolul unui câmp: din tipul întrebării (când avem definiția formularului), altfel din cheie */
function roleOf(key: string, type?: string): Role {
  switch (type) {
    case "FIRST_NAME": return "first";
    case "LAST_NAME": return "last";
    case "FULL_NAME": return "full";
    case "PHONE": return "phone";
    case "EMAIL": return "email";
    case "CUSTOM": return "custom";
  }
  const k = fold(key);
  if (k === "first_name" || k === "prenume" || k === "prenumele") return "first";
  if (k === "last_name" || k === "nume" || k === "numele" || k.includes("nume_de_familie") || k === "familia") return "last";
  if (k === "full_name" || k === "name" || k.includes("nume_complet") || k.includes("nume_si_prenume") || k.includes("nume_prenume")) return "full";
  if (k === "phone_number" || k.includes("phone") || k.includes("telefon")) return "phone";
  if (k === "email" || k.includes("email") || k.includes("e-mail") || k.includes("e_mail")) return "email";
  return "custom";
}

/** „ce_buget_aveți?_(eur)” → „Ce buget aveți? (eur)” — când nu avem eticheta din formular */
export function humanizeKey(key: string): string {
  const text = key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : key;
}

export function parseFieldData(fields: LeadgenField[] | null | undefined, questions?: FormQuestion[] | null): ParsedLeadgen {
  const byKey = new Map<string, FormQuestion>();
  for (const q of questions ?? []) if (q.key) byKey.set(q.key, q);
  const list = (fields ?? [])
    .filter((f) => f.name)
    .map((f) => {
      const key = f.name as string;
      const q = byKey.get(key);
      return { key, role: roleOf(key, q?.type), label: q?.label?.trim() || humanizeKey(key), value: f.values?.find((v) => v && v.trim())?.trim() ?? null };
    });
  const pick = (role: Role) => list.find((f) => f.role === role && f.value)?.value ?? null;

  let firstName = pick("first") ?? "";
  let lastName = pick("last") ?? "";
  if (!firstName && !lastName) {
    const full = pick("full");
    if (full) {
      const parts = full.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
  }
  const answers: LeadAnswer[] = list
    .filter((f) => f.role === "custom" && f.value)
    .map((f) => ({ key: f.key, question: f.label, answer: f.value as string }));
  const find = (test: (word: string) => boolean) =>
    answers.find((a) => words(a.question).some(test) || words(a.key).some(test))?.answer ?? null;
  return {
    firstName: firstName || "Client",
    lastName: lastName || "Facebook",
    phone: normalizePhone(pick("phone")),
    email: pick("email")?.toLowerCase() ?? null,
    furnitureType: find((w) => /^(tip|tipul|type)$/.test(w)),
    budget: find((w) => /^(buget|bugetul|budget)/.test(w)),
    answers,
  };
}

/** un eveniment `leadgen` din `entry[].changes[]` */
export interface LeadgenChange {
  leadgenId: string;
  pageId: string | null;
  formId: string | null;
  adId: string | null;
  createdTime: number | null;
}

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

export function extractLeadgenChanges(body: unknown): LeadgenChange[] {
  if (!isDict(body) || body.object !== "page" || !Array.isArray(body.entry)) return [];
  const out: LeadgenChange[] = [];
  for (const entry of body.entry) {
    if (!isDict(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isDict(change) || change.field !== "leadgen" || !isDict(change.value)) continue;
      const v = change.value;
      const leadgenId = str(v.leadgen_id);
      if (!leadgenId) continue;
      out.push({
        leadgenId,
        pageId: str(v.page_id) ?? str(entry.id),
        formId: str(v.form_id),
        adId: str(v.ad_id),
        createdTime: typeof v.created_time === "number" ? v.created_time : null,
      });
    }
  }
  return out;
}

/** textul care ajunge în comentariul clientului: „📋 Formular Facebook · {reclamă}” + câte o linie per răspuns */
export function leadgenComment(p: { adName?: string | null; answers?: LeadAnswer[] | null }): string {
  return [
    `📋 Formular Facebook${p.adName ? ` · ${p.adName}` : ""}`,
    ...(p.answers ?? []).map((a) => `${a.question.replace(/:\s*$/, "")}: ${a.answer}`),
  ].join("\n");
}

// ─────────────────────────── Messenger / Instagram DM ───────────────────────────

export interface MessagingEvent {
  /** PSID (Messenger) sau IGSID (Instagram) al persoanei */
  senderId: string;
  recipientId: string | null;
  /** ms de la epocă */
  timestamp: number | null;
  /** message.text, altfel titlul butonului apăsat, altfel payload-ul quick reply; „[atașament]” dacă a trimis doar o poză */
  text: string | null;
  mid: string | null;
  /** reclama din care a pornit conversația (referral / postback.referral / message.referral) */
  adId: string | null;
  /** mesaj trimis de pagină (ecou) — se ignoră */
  isEcho: boolean;
}

export function extractMessagingEvents(body: unknown): { platform: MetaPlatformName; events: MessagingEvent[] } | null {
  if (!isDict(body) || !Array.isArray(body.entry)) return null;
  const platform: MetaPlatformName | null = body.object === "page" ? "facebook" : body.object === "instagram" ? "instagram" : null;
  if (!platform) return null;
  const events: MessagingEvent[] = [];
  for (const entry of body.entry) {
    if (!isDict(entry) || !Array.isArray(entry.messaging)) continue;
    for (const ev of entry.messaging) {
      if (!isDict(ev)) continue;
      const message = isDict(ev.message) ? ev.message : null;
      const postback = isDict(ev.postback) ? ev.postback : null;
      const referral = isDict(ev.referral) ? ev.referral : null;
      // livrări, citiri, reacții etc. nu ne interesează
      if (!message && !postback && !referral) continue;
      const senderId = isDict(ev.sender) ? str(ev.sender.id) : null;
      if (!senderId) continue;
      const quickReply = message && isDict(message.quick_reply) ? str(message.quick_reply.payload) : null;
      const attachments = message && Array.isArray(message.attachments) && message.attachments.length > 0;
      const text = (message && str(message.text)) ?? (postback && str(postback.title)) ?? quickReply ?? (attachments ? "[atașament]" : null);
      const adId =
        (referral && str(referral.ad_id)) ??
        (postback && isDict(postback.referral) ? str(postback.referral.ad_id) : null) ??
        (message && isDict(message.referral) ? str(message.referral.ad_id) : null);
      events.push({
        senderId,
        recipientId: isDict(ev.recipient) ? str(ev.recipient.id) : null,
        timestamp: typeof ev.timestamp === "number" ? ev.timestamp : null,
        text,
        mid: message ? str(message.mid) : null,
        adId,
        isEcho: !!(message && message.is_echo === true),
      });
    }
  }
  return { platform, events };
}

export function platformLabel(platform: MetaPlatformName): string {
  return platform === "instagram" ? "Instagram DM" : "Messenger";
}

/** „💬 Messenger · ad 123\nPrimul mesaj: „Bună”\nRăspunde din Inbox (Business Suite)” */
export function messageComment(p: { platform: MetaPlatformName; adId?: string | null; text?: string | null }): string {
  return [
    `💬 ${platformLabel(p.platform)}${p.adId ? ` · ad ${p.adId}` : ""}`,
    p.text ? `Primul mesaj: „${p.text}”` : null,
    "Răspunde din Inbox (Business Suite)",
  ]
    .filter(Boolean)
    .join("\n");
}

/** numele persoanei din profilul Graph API: Messenger dă first_name/last_name, Instagram name/username */
export function nameFromProfile(
  platform: MetaPlatformName,
  profile: { first_name?: string; last_name?: string; name?: string; username?: string } | null | undefined
): { firstName: string; lastName: string } {
  const fallback = { firstName: "Client", lastName: platform === "instagram" ? "Instagram" : "Facebook" };
  if (!profile) return fallback;
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  if (first || last) return { firstName: first || fallback.firstName, lastName: last || fallback.lastName };
  const name = profile.name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") || fallback.lastName };
  }
  if (profile.username?.trim()) return { firstName: `@${profile.username.trim()}`, lastName: fallback.lastName };
  return fallback;
}
