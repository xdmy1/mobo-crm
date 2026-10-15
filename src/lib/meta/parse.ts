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

export interface ParsedLeadgen {
  firstName: string;
  lastName: string;
  /** în forma canonică din CRM (+373…) */
  phone: string | null;
  email: string | null;
  /** „Ce tip de mobilă căutați?” */
  furnitureType: string | null;
  /** „Ce buget aproximativ aveți? (EUR)” */
  budget: string | null;
}

/** cheia întrebării fără diacritice și cu litere mici: „Ce buget aveți?” → „ce buget aveti?” */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STANDARD = new Set(["full_name", "first_name", "last_name", "name", "phone_number", "phone", "email"]);

export function parseFieldData(fields: LeadgenField[] | null | undefined): ParsedLeadgen {
  const list = (fields ?? []).map((f) => ({ key: fold(f.name ?? ""), value: f.values?.find((v) => v && v.trim())?.trim() ?? null }));
  const pick = (pred: (key: string) => boolean) => list.find((f) => f.value && pred(f.key))?.value ?? null;

  let firstName = pick((k) => k === "first_name") ?? "";
  let lastName = pick((k) => k === "last_name") ?? "";
  if (!firstName && !lastName) {
    const full = pick((k) => k === "full_name" || k === "name");
    if (full) {
      const parts = full.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
  }
  // întrebările custom se recunosc după cuvinte, nu după subșiruri („tip” nu trebuie să prindă „multiple”)
  const words = (k: string) => k.split(/[^a-z]+/).filter(Boolean);
  const custom = (test: (word: string) => boolean) => pick((k) => !STANDARD.has(k) && words(k).some(test));
  return {
    firstName: firstName || "Client",
    lastName: lastName || "Facebook",
    phone: normalizePhone(pick((k) => k === "phone_number" || k.includes("phone") || k.includes("telefon"))),
    email: pick((k) => k === "email" || k.includes("email") || k.includes("e-mail"))?.toLowerCase() ?? null,
    furnitureType: custom((w) => /^(tip|tipul|type|mobila|mobilier|furniture)$/.test(w)),
    budget: custom((w) => /^(buget|bugetul|budget)/.test(w)),
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

/** textul care ajunge în comentariul clientului: „📋 Formular Facebook · {reclamă}\nTip: …\nBuget: …” */
export function leadgenComment(p: { adName?: string | null; furnitureType?: string | null; budget?: string | null }): string {
  return [
    `📋 Formular Facebook${p.adName ? ` · ${p.adName}` : ""}`,
    p.furnitureType ? `Tip: ${p.furnitureType}` : null,
    p.budget ? `Buget: ${p.budget}` : null,
  ]
    .filter(Boolean)
    .join("\n");
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
