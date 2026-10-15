// Secțiunea „Meta Ads”: tot ce a intrat din Facebook (formulare instant, Messenger) și Instagram (DM).
// Lead-urile stau aici, cu datele și mesajele lor, și devin clienți în Bord Vânzări doar când cineva
// apasă „Creează client”. Datele vin din webhook-ul Meta (src/app/api/meta/webhook, docs/meta-webhook.md).

import { Fragment } from "react";
import Link from "next/link";
import { ExternalLink, FileText, MessageCircle, Phone, Mail, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { MetaLeadKind, MetaPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { personName } from "@/lib/people";
import { parseFieldData, type LeadAnswer, type LeadgenField } from "@/lib/meta/parse";
import { cn } from "@/lib/cn";
import { contactStageColor } from "@/lib/status";
import { metaTokenStatus } from "@/server/meta";
import { PageHeader, StatCard } from "@/components/layout/PageHeader";
import { Badge, Empty } from "@/components/ui/Misc";
import { FacebookLogo, InstagramLogo, MetaTile, PlatformLogo } from "@/components/meta/MetaBrand";
import { MetaLeadActions } from "./MetaLeadActions";

export const metadata = { title: "Meta Ads — MOBO CRM" };
export const dynamic = "force-dynamic";

const INBOX_URL = "https://business.facebook.com/latest/inbox/all";
const FILTERS: Array<{ key: string; label: string }> = [
  { key: "noi", label: "Noi" },
  { key: "all", label: "Toate" },
  { key: "leadgen", label: "Formulare" },
  { key: "messenger", label: "Messenger" },
  { key: "instagram", label: "Instagram DM" },
  { key: "clienti", label: "Deveniți clienți" },
  { key: "respinse", label: "Respinse" },
];

function kindLabel(kind: MetaLeadKind, platform: MetaPlatform): string {
  if (kind === "LEADGEN") return "Formular instant";
  return platform === "INSTAGRAM" ? "Instagram DM" : "Messenger";
}

/** lead-urile filtrate + cifrele de sus */
async function loadMetaLeads(filter: string) {
  const alive = { archivedAt: null };
  const where =
    filter === "noi"
      ? { ...alive, contactId: null }
      : filter === "leadgen"
        ? { ...alive, kind: "LEADGEN" as const }
        : filter === "messenger"
          ? { ...alive, kind: "MESSAGE" as const, platform: "FACEBOOK" as const }
          : filter === "instagram"
            ? { ...alive, platform: "INSTAGRAM" as const }
            : filter === "clienti"
              ? { ...alive, contactId: { not: null } }
              : filter === "respinse"
                ? { archivedAt: { not: null } }
                : alive;

  const since = new Date(Date.now() - 7 * 86400000);
  return Promise.all([
    prisma.metaLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        contact: { include: { stage: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 3 },
        _count: { select: { messages: true } },
      },
    }),
    prisma.metaLead.count({ where: { archivedAt: null, contactId: null } }),
    prisma.metaLead.count({ where: { contactId: { not: null } } }),
    prisma.metaLead.count({ where: { createdAt: { gte: since } } }),
    prisma.metaLead.groupBy({ by: ["platform"], where: { archivedAt: null }, _count: { _all: true } }),
  ]);
}

export default async function MetaAdsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireUser();
  const { f } = await searchParams;
  const filter = FILTERS.some((x) => x.key === f) ? (f as string) : "noi";
  const [[leads, fresh, converted, week, byPlatform], token] = await Promise.all([loadMetaLeads(filter), metaTokenStatus()]);
  const platformCount = (p: MetaPlatform) => byPlatform.find((r) => r.platform === p)?._count._all ?? 0;

  const tokenProblem = !token.configured ? "Page token lipsă" : !token.valid ? `Page token invalid${token.error ? ` (${token.error})` : ""}` : token.missing.length ? `Page token fără: ${token.missing.join(", ")}` : null;
  const config: Array<{ label: string; state: "ok" | "warn" | "bad" }> = [
    { label: "Verify token", state: process.env.META_VERIFY_TOKEN ? "ok" : "bad" },
    { label: "App secret", state: process.env.META_APP_SECRET ? "ok" : "bad" },
    tokenProblem
      ? { label: tokenProblem, state: "bad" }
      : token.missingInstagram.length
        ? { label: "Page token (fără permisiunile Instagram)", state: "warn" }
        : { label: "Page token", state: "ok" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <MetaTile size="lg" />
            <span>Meta Ads</span>
          </span>
        }
        subtitle="Formularele Facebook, Messenger și Instagram DM intră aici. Un lead devine client în Bord Vânzări doar când apăsați „Creează client”."
        actions={
          <a
            href={INBOX_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-subtle"
          >
            <MessageCircle className="h-4 w-4 text-muted" />
            Inbox Business Suite
            <ExternalLink className="h-3.5 w-3.5 text-muted" />
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lead-uri noi" value={fresh} sub="așteaptă o decizie" tone="lime" href="/admin/meta?f=noi" />
        <StatCard label="Deveniți clienți" value={converted} sub="în Bord Vânzări" tone="green" href="/admin/meta?f=clienti" />
        <StatCard label="Ultimele 7 zile" value={week} sub="lead-uri intrate" tone="blue" />
        <StatCard label="Facebook / Instagram" value={`${platformCount("FACEBOOK")} / ${platformCount("INSTAGRAM")}`} sub="pe platforme" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5 shadow-xs" aria-label="Filtru">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={x.key === "noi" ? "/admin/meta" : `/admin/meta?f=${x.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                filter === x.key ? "bg-invert text-invert-fg" : "text-muted hover:text-foreground"
              )}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {config.map((c) => (
            <span key={c.label} className={cn("inline-flex items-center gap-1", c.state === "bad" && "text-danger", c.state === "warn" && "text-warn")}>
              {c.state === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : c.state === "warn" ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {c.label}
            </span>
          ))}
          {config.some((c) => c.state === "bad") && <span className="text-danger">— vezi docs/meta-webhook.md</span>}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <Empty
            text={filter === "noi" ? "Niciun lead nou — tot ce intră din Meta apare aici imediat." : "Nimic în acest filtru."}
            icon={<MetaTile size="sm" className="shadow-none" />}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const raw = lead.raw as { field_data?: LeadgenField[]; answers?: LeadAnswer[] } | null;
            const answers = raw?.answers ?? (lead.kind === "LEADGEN" && raw?.field_data ? parseFieldData(raw.field_data).answers : []);
            const contact = lead.contact && !lead.contact.deletedAt ? lead.contact : null;
            const name = lead.firstName || lead.lastName ? personName(lead) : contact ? personName(contact) : "Persoană necunoscută";
            const messages = [...lead.messages].reverse();
            const archived = !!lead.archivedAt;
            return (
              <li key={lead.id} className={cn("flex gap-4 rounded-xl border border-border bg-card p-4 shadow-xs", archived && "opacity-60")}>
                <PlatformLogo platform={lead.platform} className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[15px] font-semibold">{name}</span>
                    <Badge color={lead.kind === "LEADGEN" ? "blue" : lead.platform === "INSTAGRAM" ? "amber" : "gray"} dot>
                      {kindLabel(lead.kind, lead.platform)}
                    </Badge>
                    {contact ? (
                      <Link href={`/admin/contact/${contact.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline">
                        <Badge color={contactStageColor(contact.stage?.name)}>client #{contact.humanId}{contact.stage ? ` · ${contact.stage.name}` : ""}</Badge>
                      </Link>
                    ) : archived ? (
                      <Badge color="gray">respins</Badge>
                    ) : (
                      <Badge color="lime" dot>nou</Badge>
                    )}
                    {lead.error && (
                      <Badge color="red" dot>
                        neprocesat
                      </Badge>
                    )}
                  </div>

                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      {lead.platform === "INSTAGRAM" ? <InstagramLogo className="h-3.5 w-3.5" /> : <FacebookLogo className="h-3.5 w-3.5" />}
                      {lead.adName ? `Reclamă: ${lead.adName}` : lead.adId ? `Reclamă ${lead.adId}` : "fără reclamă (organic)"}
                    </span>
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                        <Phone className="h-3.5 w-3.5 text-muted" /> {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3.5 w-3.5" /> {lead.email}
                      </a>
                    )}
                  </p>

                  {answers.length > 0 && (
                    <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
                      {answers.map((a) => (
                        <Fragment key={a.key}>
                          <dt className="text-muted">{a.question.replace(/:\s*$/, "")}</dt>
                          <dd className="font-medium">{a.answer}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}

                  {messages.length > 0 && (
                    <ol className="space-y-1.5">
                      {messages.map((m) => (
                        <li key={m.id} className="flex items-start gap-2 text-[13px]">
                          <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted">{fmtDateTime(m.sentAt)}</span>
                          <span className="rounded-lg rounded-tl-sm bg-subtle px-2.5 py-1">{m.text}</span>
                        </li>
                      ))}
                      {lead._count.messages > messages.length && (
                        <li className="text-[12px] text-muted">încă {lead._count.messages - messages.length} mesaje mai vechi</li>
                      )}
                    </ol>
                  )}

                  {lead.error && (
                    <p className="flex items-start gap-1.5 text-[12px] text-danger">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {lead.error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <MetaLeadActions id={lead.id} contactId={contact?.id ?? null} archived={archived} />
                    {lead.kind === "MESSAGE" && (
                      <a href={INBOX_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
                        Răspunde în Inbox <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[12px] text-muted">
                  <span className="tabular-nums">{fmtDateTime(lead.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    {lead.kind === "MESSAGE" ? <MessageCircle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {lead.kind === "MESSAGE" ? `${lead._count.messages} mesaje` : "formular"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
