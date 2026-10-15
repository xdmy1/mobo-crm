// Procesarea evenimentelor Meta (Facebook Lead Ads, Messenger, Instagram DM) primite prin
// src/app/api/meta/webhook/route.ts. Rulează după ce webhook-ul a răspuns 200 (next/server `after`).
//
// - formular instant: luăm lead-ul din Graph API, creăm clientul (Lead, sursa Facebook) cu comentariul
//   „📋 Formular Facebook · …”; dacă telefonul există deja, clientul nu se dublează — primește o notă;
// - mesaj: la primul mesaj al unei persoane creăm clientul (telefon gol, sursa Facebook/Instagram) cu
//   „💬 Messenger · ad …”; mesajele următoare se adaugă doar în istoric (MetaMessage).
// Deduplicare: MetaLead.metaId (leadgen_id sau PSID/IGSID) și MetaMessage.mid sunt unice.

import { Prisma, type MetaLead, type MetaPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { personName } from "@/lib/people";
import {
  extractLeadgenChanges,
  extractMessagingEvents,
  leadgenComment,
  messageComment,
  nameFromProfile,
  parseFieldData,
  platformLabel,
  type LeadgenChange,
  type MessagingEvent,
  type MetaPlatformName,
} from "@/lib/meta/parse";
import { createLeadContact, findContactByPhone, notifySales } from "@/server/leads";

const GRAPH_BASE = process.env.META_GRAPH_BASE || "https://graph.facebook.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";

const log = (...a: unknown[]) => console.log("[meta]", ...a);
const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const toJson = (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
const asPlatform = (p: MetaPlatformName): MetaPlatform => (p === "instagram" ? "INSTAGRAM" : "FACEBOOK");

/** GET pe Graph API cu Page Access Token-ul; URL-ul (cu token) nu se loghează niciodată. */
async function graphGet<T>(path: string, fields: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) throw new Error("META_PAGE_TOKEN lipsește din mediu");
  const url = new URL(`${GRAPH_BASE}/${GRAPH_VERSION}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || !data || data.error) {
    throw new Error(`Graph API ${res.status}${data?.error?.code ? ` (cod ${data.error.code})` : ""}: ${data?.error?.message ?? "răspuns invalid"}`);
  }
  return data;
}

/** responsabilul implicit al lead-urilor din Meta (CRM_DEFAULT_RESPONSIBLE_ID), doar dacă e un angajat activ */
async function defaultResponsibleId(): Promise<number | null> {
  const id = parseInt(process.env.CRM_DEFAULT_RESPONSIBLE_ID ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  const staff = await prisma.staff.findFirst({ where: { id, active: true }, select: { id: true } });
  return staff?.id ?? null;
}

/** intrarea MetaLead e „revendicată” prima — unicitatea pe metaId oprește dublurile la retrimiteri */
async function claimMetaLead(data: Prisma.MetaLeadUncheckedCreateInput): Promise<{ lead: MetaLead; fresh: boolean }> {
  const existing = await prisma.metaLead.findUnique({ where: { metaId: data.metaId } });
  if (existing) return { lead: existing, fresh: false };
  try {
    return { lead: await prisma.metaLead.create({ data }), fresh: true };
  } catch (e) {
    // două livrări simultane ale aceluiași eveniment: a câștigat cealaltă
    if (!isUniqueViolation(e)) throw e;
    return { lead: await prisma.metaLead.findUniqueOrThrow({ where: { metaId: data.metaId } }), fresh: false };
  }
}

async function activeContact(contactId: number | null) {
  if (!contactId) return null;
  return prisma.contact.findFirst({ where: { id: contactId, deletedAt: null } });
}

/** Toate evenimentele dintr-o livrare; o eroare la unul nu le oprește pe celelalte. */
export async function processMetaWebhook(body: unknown): Promise<void> {
  for (const change of extractLeadgenChanges(body)) {
    try {
      await handleLeadgen(change);
    } catch (err) {
      console.error(`[meta] formular ${change.leadgenId}:`, err instanceof Error ? err.message : err);
    }
  }
  const messaging = extractMessagingEvents(body);
  if (!messaging) return;
  for (const ev of messaging.events) {
    try {
      await handleMessage(messaging.platform, ev);
    } catch (err) {
      console.error(`[meta] mesaj de la ${ev.senderId}:`, err instanceof Error ? err.message : err);
    }
  }
}

// ─────────────────────────── formular instant ───────────────────────────

interface GraphLead {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  platform?: "fb" | "ig" | string;
  field_data?: Array<{ name?: string; values?: string[] }>;
}

export async function handleLeadgen(change: LeadgenChange): Promise<void> {
  const { lead: row, fresh } = await claimMetaLead({
    metaId: change.leadgenId,
    kind: "LEADGEN",
    platform: "FACEBOOK",
    adId: change.adId,
    formId: change.formId,
    raw: toJson(change),
  });
  if (!fresh && row.contactId) {
    log(`formular ${change.leadgenId} deja procesat (client #${row.contactId})`);
    return;
  }

  let lead: GraphLead;
  try {
    lead = await graphGet<GraphLead>(change.leadgenId, "field_data,created_time,ad_id,ad_name,form_id,platform");
  } catch (err) {
    await prisma.metaLead.update({ where: { id: row.id }, data: { error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }

  const parsed = parseFieldData(lead.field_data);
  const platform: MetaPlatform = lead.platform === "ig" ? "INSTAGRAM" : "FACEBOOK";
  const comment = leadgenComment({ adName: lead.ad_name, furnitureType: parsed.furnitureType, budget: parsed.budget });
  const existing = await findContactByPhone(parsed.phone);

  let contactId: number;
  if (existing) {
    // același telefon → același client; detaliile formularului ajung ca mesaj în fișă
    contactId = existing.id;
    await prisma.note.create({ data: { title: "Formular Facebook (client existent)", body: comment, contactId } });
    await notifySales(
      `Clientul ${personName(existing)} (#${existing.humanId}) a completat din nou formularul Facebook${lead.ad_name ? ` „${lead.ad_name}”` : ""}.`,
      `/admin/contact/${existing.id}`,
      existing.staffId
    );
  } else {
    const contact = await createLeadContact({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
      email: parsed.email,
      sourceNames: [platform === "INSTAGRAM" ? "Instagram" : "Facebook"],
      staffId: await defaultResponsibleId(),
      comment,
      fallbackLastName: "Facebook",
    });
    contactId = contact.id;
    await audit(null, "create", "contact", contact.id, { via: "meta-leadgen", leadgenId: change.leadgenId });
    await notifySales(
      `Lead nou din formularul Facebook${lead.ad_name ? ` „${lead.ad_name}”` : ""}: ${personName(contact)}${parsed.phone ? ` (${parsed.phone})` : ""}.`,
      `/admin/contact/${contact.id}`,
      contact.staffId
    );
  }

  await prisma.metaLead.update({
    where: { id: row.id },
    data: {
      contactId,
      platform,
      adId: lead.ad_id ?? change.adId,
      adName: lead.ad_name ?? null,
      formId: lead.form_id ?? change.formId,
      raw: toJson(lead),
      error: null,
    },
  });
  log(`formular ${change.leadgenId} → client #${contactId}${existing ? " (existent)" : ""}`);
}

// ─────────────────────────── Messenger / Instagram DM ───────────────────────────

async function saveMessage(metaLeadId: number, ev: MessagingEvent): Promise<void> {
  if (!ev.text) return;
  // postback-urile nu au mid; expeditor + timestamp identifică evenimentul la retrimiteri
  const mid = ev.mid ?? (ev.timestamp ? `evt:${ev.senderId}:${ev.timestamp}` : null);
  if (mid && (await prisma.metaMessage.findUnique({ where: { mid }, select: { id: true } }))) return;
  try {
    await prisma.metaMessage.create({
      data: { metaLeadId, mid, text: ev.text, sentAt: ev.timestamp ? new Date(ev.timestamp) : new Date() },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e; // același mesaj livrat de două ori în același moment
  }
}

export async function handleMessage(platform: MetaPlatformName, ev: MessagingEvent): Promise<void> {
  if (ev.isEcho || !ev.senderId || ev.senderId === ev.recipientId) return;

  const { lead: row, fresh } = await claimMetaLead({
    metaId: ev.senderId,
    kind: "MESSAGE",
    platform: asPlatform(platform),
    adId: ev.adId,
    raw: toJson(ev),
  });
  const contact = fresh ? null : await activeContact(row.contactId);
  if (contact) {
    // persoană cunoscută: doar istoricul
    await saveMessage(row.id, ev);
    return;
  }

  // prima conversație (sau clientul de atunci a fost șters): client nou
  let profile: Parameters<typeof nameFromProfile>[1] = null;
  try {
    profile = await graphGet(ev.senderId, platform === "instagram" ? "name,username" : "first_name,last_name");
  } catch (err) {
    log(`profilul ${ev.senderId} nu a putut fi citit:`, err instanceof Error ? err.message : err);
  }
  const name = nameFromProfile(platform, profile);
  const comment = messageComment({ platform, adId: ev.adId ?? row.adId, text: ev.text });
  const created = await createLeadContact({
    ...name,
    phone: null,
    email: null,
    sourceNames: [platform === "instagram" ? "Instagram" : "Facebook"],
    staffId: await defaultResponsibleId(),
    comment,
    fallbackLastName: platform === "instagram" ? "Instagram" : "Facebook",
  });
  await prisma.metaLead.update({
    where: { id: row.id },
    data: { contactId: created.id, adId: ev.adId ?? row.adId, raw: toJson({ ...ev, profile }), error: null },
  });
  await saveMessage(row.id, ev);
  await audit(null, "create", "contact", created.id, { via: `meta-${platform}`, senderId: ev.senderId });
  await notifySales(
    `Lead nou din ${platformLabel(platform)}: ${personName(created)}${ev.text ? ` — „${ev.text.slice(0, 80)}”` : ""}`,
    `/admin/contact/${created.id}`,
    created.staffId
  );
  log(`${platformLabel(platform)} ${ev.senderId} → client #${created.id}`);
}

// ─────────────────────────── starea token-ului (pagina Meta Leads) ───────────────────────────

/** permisiunile de care are nevoie integrarea; lipsa lor se vede în Meta Leads, lângă „Page token” */
export const REQUIRED_SCOPES = [
  "pages_messaging",
  "leads_retrieval",
  "pages_manage_ads",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
];

export interface TokenStatus {
  configured: boolean;
  valid: boolean;
  /** permisiunile cerute care lipsesc din token */
  missing: string[];
  error?: string;
}

let tokenCache: { at: number; token: string; status: TokenStatus } | null = null;

/** Verifică token-ul la Graph API (debug_token); rezultatul se ține 10 minute. */
export async function metaTokenStatus(): Promise<TokenStatus> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return { configured: false, valid: false, missing: REQUIRED_SCOPES };
  if (tokenCache && tokenCache.token === token && Date.now() - tokenCache.at < 10 * 60_000) return tokenCache.status;
  let status: TokenStatus;
  try {
    const data = await graphGet<{ data?: { is_valid?: boolean; scopes?: string[] } }>("debug_token", "", { input_token: token });
    const scopes = new Set(data.data?.scopes ?? []);
    status = { configured: true, valid: data.data?.is_valid === true, missing: REQUIRED_SCOPES.filter((s) => !scopes.has(s)) };
  } catch (err) {
    status = { configured: true, valid: false, missing: REQUIRED_SCOPES, error: err instanceof Error ? err.message : String(err) };
  }
  tokenCache = { at: Date.now(), token, status };
  return status;
}
