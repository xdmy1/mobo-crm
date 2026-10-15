// Secțiunea „Meta Leads”: tot ce a intrat din Facebook (formulare instant, Messenger) și Instagram (DM),
// cu clientul creat în Bord Vânzări, reclama de origine și ultimele mesaje. Datele vin din webhook-ul Meta
// (src/app/api/meta/webhook, docs/meta-webhook.md).

import Link from "next/link";
import { ExternalLink, FileText, MessageCircle, Phone, Mail, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { MetaLeadKind, MetaPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { personName } from "@/lib/people";
import { parseFieldData, type LeadgenField } from "@/lib/meta/parse";
import { cn } from "@/lib/cn";
import { contactStageColor } from "@/lib/status";
import { metaTokenStatus } from "@/server/meta";
import { PageHeader, StatCard } from "@/components/layout/PageHeader";
import { Badge, Empty } from "@/components/ui/Misc";
import { FacebookLogo, InstagramLogo, MetaTile, PlatformLogo } from "@/components/meta/MetaBrand";

export const metadata = { title: "Meta Leads — MOBO CRM" };
export const dynamic = "force-dynamic";

const INBOX_URL = "https://business.facebook.com/latest/inbox/all";
const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Toate" },
  { key: "leadgen", label: "Formulare" },
  { key: "messenger", label: "Messenger" },
  { key: "instagram", label: "Instagram DM" },
];

function kindLabel(kind: MetaLeadKind, platform: MetaPlatform): string {
  if (kind === "LEADGEN") return "Formular instant";
  return platform === "INSTAGRAM" ? "Instagram DM" : "Messenger";
}

/** lead-urile filtrate + cifrele de sus (totaluri, ultimele 7 zile, pe platformă, pe tip) */
async function loadMetaLeads(filter: string) {
  const where =
    filter === "leadgen"
      ? { kind: "LEADGEN" as const }
      : filter === "messenger"
        ? { kind: "MESSAGE" as const, platform: "FACEBOOK" as const }
        : filter === "instagram"
          ? { platform: "INSTAGRAM" as const }
          : {};

  const since = new Date(Date.now() - 7 * 86400000);
  return Promise.all([
    prisma.metaLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        contact: { include: { stage: true, staff: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 3 },
        _count: { select: { messages: true } },
      },
    }),
    prisma.metaLead.count(),
    prisma.metaLead.count({ where: { createdAt: { gte: since } } }),
    prisma.metaLead.groupBy({ by: ["platform"], _count: { _all: true } }),
    prisma.metaLead.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
}

export default async function MetaLeadsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireUser();
  const { f } = await searchParams;
  const filter = FILTERS.some((x) => x.key === f) ? (f as string) : "all";
  const [[leads, total, week, byPlatform, byKind], token] = await Promise.all([loadMetaLeads(filter), metaTokenStatus()]);
  const count = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string, value: string) =>
    rows.find((r) => r[key] === value)?._count._all ?? 0;

  const config = [
    { label: "Verify token", ok: !!process.env.META_VERIFY_TOKEN },
    { label: "App secret", ok: !!process.env.META_APP_SECRET },
    {
      label: !token.configured
        ? "Page token lipsă"
        : !token.valid
          ? `Page token invalid${token.error ? ` (${token.error})` : ""}`
          : token.missing.length
            ? `Page token fără: ${token.missing.join(", ")}`
            : "Page token",
      ok: token.configured && token.valid && token.missing.length === 0,
    },
  ];
  const configured = config.every((c) => c.ok);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <MetaTile size="lg" />
            <span>Meta Leads</span>
          </span>
        }
        subtitle="Formularele Facebook, Messenger și Instagram DM intră automat în Bord Vânzări, etapa „Lead”."
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
        <StatCard label="Lead-uri din Meta" value={total} sub="de la pornirea integrării" tone="lime" />
        <StatCard label="Ultimele 7 zile" value={week} tone="green" />
        <StatCard
          label="Facebook"
          value={count(byPlatform, "platform", "FACEBOOK")}
          sub={`${count(byKind, "kind", "LEADGEN")} formulare · ${count(byKind, "kind", "MESSAGE") - count(byPlatform, "platform", "INSTAGRAM")} Messenger`}
          tone="blue"
        />
        <StatCard label="Instagram" value={count(byPlatform, "platform", "INSTAGRAM")} sub="mesaje directe" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-xs" aria-label="Filtru">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/admin/meta" : `/admin/meta?f=${x.key}`}
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
            <span key={c.label} className="inline-flex items-center gap-1">
              {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-danger" />}
              {c.label}
            </span>
          ))}
          {!configured && (
            <span className="text-danger">— conexiunea nu e completă, vezi docs/meta-webhook.md</span>
          )}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <Empty
            text={filter === "all" ? "Niciun lead din Meta încă — vor apărea aici imediat ce intră pe webhook." : "Nimic în acest filtru."}
            icon={<MetaTile size="sm" className="shadow-none" />}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const raw = lead.raw as { field_data?: LeadgenField[] } | null;
            const form = lead.kind === "LEADGEN" && raw?.field_data ? parseFieldData(raw.field_data) : null;
            const contact = lead.contact && !lead.contact.deletedAt ? lead.contact : null;
            const name = contact ? personName(contact) : form ? `${form.firstName} ${form.lastName}` : "Persoană necunoscută";
            const messages = [...lead.messages].reverse();
            return (
              <li key={lead.id} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
                <PlatformLogo platform={lead.platform} className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {contact ? (
                      <Link href={`/admin/contact/${contact.id}`} className="text-[15px] font-semibold hover:underline">
                        {name}
                        <span className="ml-1.5 text-[12px] font-normal text-muted">#{contact.humanId}</span>
                      </Link>
                    ) : (
                      <span className="text-[15px] font-semibold text-muted">{name}</span>
                    )}
                    <Badge color={lead.kind === "LEADGEN" ? "blue" : lead.platform === "INSTAGRAM" ? "amber" : "gray"} dot>
                      {kindLabel(lead.kind, lead.platform)}
                    </Badge>
                    {contact?.stage && <Badge color={contactStageColor(contact.stage.name)}>{contact.stage.name}</Badge>}
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
                    {contact?.phone && (
                      <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-3.5 w-3.5" /> {contact.phone}
                      </a>
                    )}
                    {contact?.email && (
                      <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3.5 w-3.5" /> {contact.email}
                      </a>
                    )}
                    {contact?.staff && <span>Responsabil: {personName(contact.staff)}</span>}
                  </p>

                  {form && (form.furnitureType || form.budget) && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.furnitureType && (
                        <span className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px]">Tip: {form.furnitureType}</span>
                      )}
                      {form.budget && (
                        <span className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px]">Buget: {form.budget} EUR</span>
                      )}
                    </div>
                  )}

                  {messages.length > 0 && (
                    <ol className="space-y-1.5">
                      {messages.map((m) => (
                        <li key={m.id} className="flex items-start gap-2 text-[13px]">
                          <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted">{fmtDateTime(m.sentAt)}</span>
                          <span className="rounded-lg rounded-tl-sm bg-subtle px-2.5 py-1">{m.text}</span>
                        </li>
                      ))}
                      {lead._count.messages > messages.length && contact && (
                        <li className="text-[12px] text-muted">
                          <Link href={`/admin/contact/${contact.id}`} className="hover:underline">
                            încă {lead._count.messages - messages.length} mesaje — vezi fișa clientului
                          </Link>
                        </li>
                      )}
                    </ol>
                  )}

                  {lead.error && (
                    <p className="flex items-start gap-1.5 text-[12px] text-danger">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {lead.error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                  <span className="text-[12px] tabular-nums text-muted">{fmtDateTime(lead.createdAt)}</span>
                  {lead.kind === "MESSAGE" ? (
                    <a
                      href={INBOX_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                    >
                      Răspunde în Inbox <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <FileText className="h-3 w-3" /> formular
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
