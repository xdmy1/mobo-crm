import Link from "next/link";
import {
  AlarmClock,
  ArrowUpRight,
  Building2,
  Calculator,
  FolderKanban,
  Hourglass,
  Megaphone,
  UserCog,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { financeAccess } from "@/lib/financeAccess";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtDate, fmtEur, fmtLei, fmtDuration, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { portfolioSum } from "@/lib/sums";
import { contactStageColor, taskPriority } from "@/lib/status";
import { Card, Badge, Empty } from "@/components/ui/Misc";
import { staffOptions } from "@/server/options";
import { PageHeader, StatCard } from "@/components/layout/PageHeader";
import { DashFilters } from "./DashFilters";

export const metadata = { title: "Bord Central — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const finance = await financeAccess(user, "readAll-finances");
  const sp = await searchParams;

  // Interval statistică
  const now = new Date();
  let from: Date;
  const period = sp.period ?? "30d";
  if (sp.from) from = new Date(sp.from);
  else {
    const days = period === "1d" ? 1 : period === "7d" ? 7 : period === "1y" ? 365 : 30;
    from = new Date(now.getTime() - days * 86400000);
  }
  const to = sp.to ? new Date(new Date(sp.to).getTime() + 86400000) : now;
  const staffId = sp.staff ? parseInt(sp.staff, 10) : null;

  const [
    usersCount,
    contactsCount,
    companiesCount,
    oppAgg,
    quoteAgg,
    contractsInRange,
    quotesInRange,
    financesInRange,
    recentContacts,
    recentQuotes,
    contactStages,
    oppStages,
    contactHist,
    oppHist,
    failureCauses,
    announcements,
    myTasks,
    upcomingDeadlines,
    expiringQuotes,
    sourcesAgg,
  ] = await Promise.all([
    prisma.staff.count({ where: { active: true } }),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.company.count(),
    // valoarea portofoliului — aceeași regulă ca în liste, borduri și fișe (doar estimările active)
    portfolioSum().then(async (value) => ({
      count: await prisma.opportunity.count({ where: { deletedAt: null } }),
      value: value.lei,
    })),
    Promise.all([
      prisma.quote.count({ where: { deletedAt: null } }),
      prisma.quote.count({ where: { deletedAt: null, active: true, opportunity: { deletedAt: null } } }),
    ]).then(([total, active]) => ({ total, active })),
    prisma.contract.findMany({
      // contractele anulate și procesele-verbale nu sunt vânzări
      where: {
        createdAt: { gte: from, lte: to },
        kind: { not: "HANDOVER" },
        status: { not: "ANULAT" },
        ...(staffId ? { contact: { staffId } } : {}),
      },
      select: { retribution: true },
    }),
    prisma.quote.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(staffId ? { staffId } : {}),
      },
      select: { totalPrice: true },
    }),
    // avansurile fac parte din stratul financiar: fără deblocare nu se încarcă deloc
    finance.allowed
      ? prisma.contractFinance.findMany({
          where: {
            contract: {
              createdAt: { gte: from, lte: to },
              status: { not: "ANULAT" },
              ...(staffId ? { contact: { staffId } } : {}),
            },
          },
          select: { avans1: true, avans2: true, avans3: true },
        })
      : Promise.resolve([] as Array<{ avans1: number; avans2: number; avans3: number }>),
    prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.quote.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { staff: true },
    }),
    prisma.contactStage.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { contacts: { where: { deletedAt: null } } } } },
    }),
    prisma.opportunityStage.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { opportunities: { where: { deletedAt: null, onProductionBoard: true } } },
        },
      },
    }),
    prisma.contactStageHistory.findMany({ select: { stageId: true, enteredAt: true, leftAt: true } }),
    prisma.opportunityStageHistory.findMany({ select: { stageId: true, enteredAt: true, leftAt: true } }),
    prisma.failureCause.findMany({
      include: { _count: { select: { contacts: { where: { deletedAt: null } } } } },
    }),
    prisma.announcement.findMany({ orderBy: { date: "desc" }, take: 5 }),
    prisma.task.findMany({
      where: {
        assigneeId: user.id,
        OR: [{ dueDate: { lte: new Date(now.getTime() + 86400000) } }, { dueDate: null }],
        status: { name: { not: "done" } },
      },
      take: 6,
      orderBy: { dueDate: "asc" },
      include: { priority: true },
    }),
    prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        closeDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
      },
      take: 6,
      orderBy: { closeDate: "asc" },
      include: { contact: true },
    }),
    prisma.quote.findMany({
      where: {
        deletedAt: null,
        active: true,
        expirationDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
      },
      take: 6,
      orderBy: { expirationDate: "asc" },
    }),
    prisma.contactSource.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
      include: { _count: { select: { contacts: { where: { deletedAt: null } } } } },
    }),
  ]);

  // Lead-uri reci [NOU]: clienți blocați în etapele timpurii de peste 7 zile
  const coldLeads = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      stage: { name: { in: ["Lead", "Apelat", "Măsurare"] } },
      stageEnteredAt: { lt: new Date(now.getTime() - 7 * 86400000) },
    },
    orderBy: { stageEnteredAt: "asc" },
    take: 6,
    include: { stage: true },
  });

  const statContracts = contractsInRange.length;
  const statSales = contractsInRange.reduce((s, c) => s + (c.retribution ?? 0), 0);
  const statAdvances = financesInRange.reduce((s, f) => s + f.avans1 + f.avans2 + f.avans3, 0);
  const statOpportunities = quotesInRange.reduce((s, q) => s + q.totalPrice, 0);

  const timePerStage = (hist: { stageId: number; enteredAt: Date; leftAt: Date | null }[]) => {
    const map = new Map<number, number>();
    for (const h of hist) {
      const ms = (h.leftAt ?? now).getTime() - h.enteredAt.getTime();
      map.set(h.stageId, (map.get(h.stageId) ?? 0) + ms);
    }
    return map;
  };
  const cTime = timePerStage(contactHist);
  const oTime = timePerStage(oppHist);
  const cTotalMs = [...cTime.values()].reduce((a, b) => a + b, 0);
  const oTotalMs = [...oTime.values()].reduce((a, b) => a + b, 0);
  const prodClients = oppStages.reduce((s, st) => s + st._count.opportunities, 0);
  const salesClients = contactStages.reduce((s, st) => s + st._count.contacts, 0);

  // Funnel vânzări [NOU]
  const funnelMax = Math.max(1, ...contactStages.map((s) => s._count.contacts));
  // Lead-uri pe sursă [NOU]
  const srcMax = Math.max(1, ...sourcesAgg.map((s) => s._count.contacts));

  const staff = await staffOptions();

  const today = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Chisinau",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const hour = parseInt(
    new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Chisinau", hour: "numeric", hour12: false }).format(now),
    10
  );
  const greeting = hour < 12 ? "Bună dimineața" : hour < 18 ? "Bună ziua" : "Bună seara";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${user.firstName}`}
        subtitle={<span className="first-letter:uppercase inline-block">{today}</span>}
      />

      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Utilizatori" value={usersCount} icon={UserCog} />
        <StatCard label="Clienți" value={contactsCount} href="/admin/contact" icon={Users} tone="lime" />
        <StatCard
          label="Persoane Juridice"
          value={companiesCount}
          href="/admin/company"
          icon={Building2}
          tone="blue"
        />
        <StatCard
          label="Proiecte"
          value={oppAgg.count}
          sub={`valoare ${fmtLei(oppAgg.value)}`}
          href="/admin/opportunity"
          icon={FolderKanban}
          tone="amber"
        />
        <StatCard
          label="Estimări"
          value={quoteAgg.total}
          sub={`${quoteAgg.active} active · restul sunt variante`}
          href="/admin/quote"
          icon={Calculator}
          tone="green"
        />
      </div>

      {/* Statistică */}
      <Card title="Statistică" extra={<DashFilters staff={staff} />} flush>
        <div className="grid divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          <Stat label="NR de Contracte" value={String(statContracts)} />
          <Stat label="Suma de vânzare" value={fmtEur(statSales)} />
          {finance.allowed && <Stat label="Suma avansurilor" value={fmtEur(statAdvances)} />}
          <Stat label="Suma estimărilor" value={fmtLei(statOpportunities)} />
        </div>
      </Card>

      {/* Widgets personale [NOU] */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card title="Sarcinile mele">
          {myTasks.length === 0 ? (
            <Empty compact text="Nicio sarcină activă" />
          ) : (
            <ul className="space-y-2">
              {myTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/task/${t.id}`} className="truncate font-medium hover:text-primary">
                    {t.name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {taskPriority(t.priority?.name) && (
                      <Badge color={taskPriority(t.priority?.name)!.color}>
                        {taskPriority(t.priority?.name)!.label}
                      </Badge>
                    )}
                    {t.dueDate ? fmtDate(t.dueDate) : EMPTY}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Deadline în 7 zile">
          {upcomingDeadlines.length === 0 ? (
            <Empty compact text="Niciun deadline apropiat" />
          ) : (
            <ul className="space-y-2">
              {upcomingDeadlines.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/opportunity/${o.id}`} className="truncate font-medium hover:text-primary">
                    {o.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-danger">
                    <AlarmClock className="h-3.5 w-3.5" /> {fmtDate(o.closeDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Estimări care expiră">
          {expiringQuotes.length === 0 ? (
            <Empty compact text="Nicio estimare nu expiră curând" />
          ) : (
            <ul className="space-y-2">
              {expiringQuotes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/quote/${q.id}`} className="truncate font-medium hover:text-primary">
                    {q.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-warn">
                    <Hourglass className="h-3.5 w-3.5" /> {fmtDate(q.expirationDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Lead-uri reci — sună-i!">
          {coldLeads.length === 0 ? (
            <Empty compact text="Niciun lead blocat — bravo!" />
          ) : (
            <ul className="space-y-2">
              {coldLeads.map((c) => {
                const days = Math.floor(
                  (now.getTime() - c.stageEnteredAt.getTime()) / 86400000
                );
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/admin/contact/${c.id}`}
                      className="truncate font-medium hover:text-primary"
                    >
                      {personName(c)}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <Badge color={contactStageColor(c.stage?.name)}>{c.stage?.name}</Badge>
                      <span className={days > 14 ? "font-bold text-danger" : "text-warn"}>
                        {days} zile
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Recenți */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          flush
          title="Clienți Recenți"
          extra={
            <Link href="/admin/contact" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-foreground">
              Uite mai multe <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <MiniTable
            head={["Nume", "Email", "Număr de contact", "Data creării"]}
            rows={recentContacts.map((c) => [
              { text: personName(c), href: `/admin/contact/${c.id}` },
              { text: c.email ?? EMPTY },
              { text: c.phone ?? EMPTY },
              { text: fmtDateTime(c.createdAt) },
            ])}
          />
        </Card>
        <Card
          flush
          title="Estimări Recente"
          extra={
            <Link href="/admin/quote" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-foreground">
              Uite mai multe <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <MiniTable
            head={["Nume", "Responsabil", "Data estimării", "Data creării"]}
            rows={recentQuotes.map((q) => [
              { text: q.name, href: `/admin/quote/${q.id}` },
              { text: personName(q.staff) },
              { text: fmtDate(q.quoteDate) },
              { text: fmtDateTime(q.createdAt) },
            ])}
          />
        </Card>
      </div>

      {/* Statistică Borduri */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Statistică Bord Vânzări">
          <p className="mb-2 text-sm text-muted">
            Total clienți: <b className="text-foreground">{salesClients}</b> · Total timp:{" "}
            <b className="text-foreground">{fmtDuration(cTotalMs)}</b>
          </p>
          <StageTable
            rows={contactStages.map((s) => ({
              name: s.name,
              count: s._count.contacts,
              time: fmtDuration(cTime.get(s.id) ?? 0),
            }))}
          />
        </Card>
        <Card title="Statistică Bord Producere">
          <p className="mb-2 text-sm text-muted">
            Total clienți: <b className="text-foreground">{prodClients}</b> · Total timp:{" "}
            <b className="text-foreground">{fmtDuration(oTotalMs)}</b>
          </p>
          <StageTable
            rows={oppStages.map((s) => ({
              name: s.name,
              count: s._count.opportunities,
              time: fmtDuration(oTime.get(s.id) ?? 0),
            }))}
          />
        </Card>
      </div>

      {/* Funnel + surse [NOU] */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Funnel vânzări">
          <div className="space-y-1.5">
            {contactStages.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0 truncate text-muted">{s.name}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-foreground/[0.05]">
                  <div
                    className="h-6 rounded-md bg-lime-brand animate-bar-grow"
                    style={{ width: `${(s._count.contacts / funnelMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold tabular-nums">{s._count.contacts}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Lead-uri pe sursă">
            <div className="space-y-1.5">
              {sourcesAgg.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate text-muted">{s.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className="h-2 rounded-full bg-foreground/75 animate-bar-grow"
                      style={{ width: `${(s._count.contacts / srcMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold tabular-nums">{s._count.contacts}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Cauze de Eșec">
            <ul className="space-y-1.5 text-sm">
              {failureCauses.map((f) => (
                <li key={f.id} className="flex items-center justify-between">
                  <span>{f.name}</span>
                  <Badge color={f._count.contacts > 0 ? "red" : "gray"}>{f._count.contacts}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Anunțuri */}
      <Card title="Anunțuri">
        {announcements.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-lg border border-border bg-subtle/50 px-4 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-brand/25 text-primary">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(a.date)}</span>
                  </div>
                  {a.body && <p className="mt-0.5 text-[13px] text-muted">{a.body}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0 lg:border-b-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function MiniTable({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<{ text: string; href?: string }>>;
}) {
  if (rows.length === 0) return <Empty compact />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-subtle/60 text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/70 transition-colors last:border-0 hover:bg-subtle/60">
              {r.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-4 py-2.5">
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {c.text}
                    </Link>
                  ) : (
                    <span className={j === 0 ? "" : "text-muted"}>{c.text}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageTable({
  rows,
}: {
  rows: Array<{ name: string; count: number; time: string }>;
}) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="py-2 font-medium">Etapa</th>
          <th className="py-2 text-center font-medium">Nr. clienți</th>
          <th className="py-2 text-right font-medium">Timpul petrecut</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-border/70 last:border-0">
            <td className="py-2">{r.name}</td>
            <td className="py-2 text-center font-semibold tabular-nums">{r.count}</td>
            <td className="py-2 text-right text-muted tabular-nums">{r.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
