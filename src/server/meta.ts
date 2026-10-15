// Procesarea evenimentelor Meta (Facebook Lead Ads, Messenger, Instagram DM) primite prin
// src/app/api/meta/webhook/route.ts. Rulează după ce webhook-ul a răspuns 200 (next/server `after`).
//
// Lead-urile NU devin clienți automat: stau în secțiunea „Meta Ads” (MetaLead, cu nume / telefon /
// email / răspunsuri / mesaje) până când cineva apasă „Creează client” (src/server/actions/meta.ts).
// - formular instant: luăm lead-ul din Graph API (+ întrebările formularului, ca răspunsurile să poarte
//   textul întrebării) și îl salvăm;
// - mesaj: la primul mesaj al unei persoane creăm lead-ul (nume din profil), mesajele următoare se
//   adaugă în istoric (MetaMessage).
// Deduplicare: MetaLead.metaId (leadgen_id sau PSID/IGSID) și MetaMessage.mid sunt unice.

import { Prisma, type MetaLead, type MetaPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { personName } from "@/lib/people";
import {
  extractLeadgenChanges,
  extractMessagingEvents,
  nameFromProfile,
  parseFieldData,
  platformLabel,
  type FormQuestion,
  type LeadgenChange,
  type MessagingEvent,
  type MetaPlatformName,
} from "@/lib/meta/parse";
import { notifySales } from "@/server/leads";

const GRAPH_BASE = process.env.META_GRAPH_BASE || "https://graph.facebook.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
export const META_ADS_PATH = "/admin/meta";

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

/** întrebările formularului (etichete + tipuri), ținute o zi — ca răspunsurile să poarte textul întrebării */
const formCache = new Map<string, { at: number; questions: FormQuestion[] }>();
async function formQuestions(formId: string | null | undefined): Promise<FormQuestion[] | null> {
  if (!formId) return null;
  const hit = formCache.get(formId);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.questions;
  try {
    const form = await graphGet<{ questions?: FormQuestion[] }>(formId, "questions");
    const questions = form.questions ?? [];
    formCache.set(formId, { at: Date.now(), questions });
    return questions;
  } catch (err) {
    log(`întrebările formularului ${formId} nu au putut fi citite:`, err instanceof Error ? err.message : err);
    return null;
  }
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
  if (!fresh && !row.error) {
    log(`formular ${change.leadgenId} deja salvat (lead #${row.id})`);
    return;
  }

  let lead: GraphLead;
  try {
    lead = await graphGet<GraphLead>(change.leadgenId, "field_data,created_time,ad_id,ad_name,form_id,platform");
  } catch (err) {
    await prisma.metaLead.update({ where: { id: row.id }, data: { error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }

  const parsed = parseFieldData(lead.field_data, await formQuestions(lead.form_id ?? change.formId));
  const platform: MetaPlatform = lead.platform === "ig" ? "INSTAGRAM" : "FACEBOOK";
  const saved = await prisma.metaLead.update({
    where: { id: row.id },
    data: {
      platform,
      adId: lead.ad_id ?? change.adId,
      adName: lead.ad_name ?? null,
      formId: lead.form_id ?? change.formId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
      email: parsed.email,
      raw: toJson({ ...lead, answers: parsed.answers }),
      error: null,
    },
  });
  await notifySales(
    `Lead nou din formularul Facebook${lead.ad_name ? ` „${lead.ad_name}”` : ""}: ${personName(saved)}${parsed.phone ? ` (${parsed.phone})` : ""} — în Meta Ads.`,
    META_ADS_PATH
  );
  log(`formular ${change.leadgenId} → lead #${row.id} (${personName(saved)})`);
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
  if (!fresh) {
    // persoană cunoscută: doar istoricul
    await saveMessage(row.id, ev);
    if (!row.adId && ev.adId) await prisma.metaLead.update({ where: { id: row.id }, data: { adId: ev.adId } });
    return;
  }

  // prima conversație: lead nou, cu numele din profil
  let profile: Parameters<typeof nameFromProfile>[1] = null;
  try {
    profile = await graphGet(ev.senderId, platform === "instagram" ? "name,username" : "first_name,last_name");
  } catch (err) {
    log(`profilul ${ev.senderId} nu a putut fi citit:`, err instanceof Error ? err.message : err);
  }
  const name = nameFromProfile(platform, profile);
  const saved = await prisma.metaLead.update({
    where: { id: row.id },
    data: { firstName: name.firstName, lastName: name.lastName, raw: toJson({ ...ev, profile }), error: null },
  });
  await saveMessage(row.id, ev);
  await notifySales(
    `Mesaj nou pe ${platformLabel(platform)} de la ${personName(saved)}${ev.text ? `: „${ev.text.slice(0, 80)}”` : ""} — în Meta Ads.`,
    META_ADS_PATH
  );
  log(`${platformLabel(platform)} ${ev.senderId} → lead #${row.id} (${personName(saved)})`);
}

// ─────────────────────────── starea token-ului (pagina Meta Ads) ───────────────────────────

/** permisiunile de care are nevoie integrarea; lipsa lor se vede în Meta Ads, lângă „Page token” */
export const REQUIRED_SCOPES = ["pages_messaging", "leads_retrieval", "pages_manage_ads", "pages_manage_metadata", "pages_read_engagement", "pages_show_list"];
/** permisiuni doar pentru Instagram (nume din profil, răspunsuri) — lipsa lor e un avertisment, nu o eroare */
export const INSTAGRAM_SCOPES = ["instagram_basic", "instagram_manage_messages"];

export interface TokenStatus {
  configured: boolean;
  valid: boolean;
  /** permisiunile de bază care lipsesc din token */
  missing: string[];
  /** permisiunile Instagram care lipsesc */
  missingInstagram: string[];
  error?: string;
}

let tokenCache: { at: number; token: string; status: TokenStatus } | null = null;

/** Verifică token-ul la Graph API (debug_token); rezultatul se ține 10 minute. */
export async function metaTokenStatus(): Promise<TokenStatus> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return { configured: false, valid: false, missing: REQUIRED_SCOPES, missingInstagram: INSTAGRAM_SCOPES };
  if (tokenCache && tokenCache.token === token && Date.now() - tokenCache.at < 10 * 60_000) return tokenCache.status;
  let status: TokenStatus;
  try {
    const data = await graphGet<{ data?: { is_valid?: boolean; scopes?: string[] } }>("debug_token", "", { input_token: token });
    const scopes = new Set(data.data?.scopes ?? []);
    status = {
      configured: true,
      valid: data.data?.is_valid === true,
      missing: REQUIRED_SCOPES.filter((s) => !scopes.has(s)),
      missingInstagram: INSTAGRAM_SCOPES.filter((s) => !scopes.has(s)),
    };
  } catch (err) {
    status = { configured: true, valid: false, missing: REQUIRED_SCOPES, missingInstagram: INSTAGRAM_SCOPES, error: err instanceof Error ? err.message : String(err) };
  }
  tokenCache = { at: Date.now(), token, status };
  return status;
}
