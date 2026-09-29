import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMonthTitle, ymdChisinau, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { staffOptions, contactStageOptions } from "@/server/options";
import { CalendarFilters } from "./CalendarFilters";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Calendar — MOBO CRM" };
export const dynamic = "force-dynamic";

interface CalEvent {
  day: string; // YYYY-MM-DD
  title: string;
  sub: string;
  href: string;
  kind: "client" | "livrare" | "deadline" | "sarcina";
}

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  client: "border-l-[#9aa80c] bg-lime-brand/25 hover:bg-lime-brand/40",
  livrare: "border-l-info bg-info/10 hover:bg-info/[0.17]",
  deadline: "border-l-warn bg-warn/[0.13] hover:bg-warn/20",
  sarcina: "border-l-foreground/50 bg-foreground/[0.06] hover:bg-foreground/10",
};

/** Ziua unui moment real (client creat, livrare, termen) — în fusul Chișinău, nu al serverului. */
const ymd = (d: Date): string => ymdChisinau(d);

/** Celulele grilei sunt date calendaristice pure, ținute la miezul nopții UTC. */
const gridKey = (d: Date): string => d.toISOString().slice(0, 10);

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  // luna curentă = cea de la Chișinău (serverul poate rula în alt fus)
  const [y, m] = (sp.m ?? ymdChisinau().slice(0, 7))
    .split("-")
    .map((x) => parseInt(x, 10));
  const monthStart = new Date(Date.UTC(y, (m || 1) - 1, 1));

  // grila: de luni înainte
  const gridStart = new Date(monthStart);
  const dow = (gridStart.getUTCDay() + 6) % 7; // luni = 0
  gridStart.setUTCDate(gridStart.getUTCDate() - dow);
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 42);
  // miezul nopții la Chișinău ≠ miezul nopții UTC → interogăm cu o zi de rezervă în ambele capete
  const qStart = new Date(gridStart.getTime() - 86_400_000);
  const qEnd = new Date(gridEnd.getTime() + 86_400_000);

  const stageIds = sp.stage ? sp.stage.split(",").map(Number).filter(Boolean) : [];
  const staffIds = sp.staff ? sp.staff.split(",").map(Number).filter(Boolean) : [];

  const [contacts, deliveries, tasks, stages, staff] = await Promise.all([
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: qStart, lt: qEnd },
        ...(stageIds.length ? { stageId: { in: stageIds } } : {}),
        ...(staffIds.length ? { staffId: { in: staffIds } } : {}),
      },
      include: { opportunities: { where: { deletedAt: null }, select: { deliveryDate: true } } },
    }),
    prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        deliveryDate: { gte: qStart, lt: qEnd },
        ...(staffIds.length ? { staffId: { in: staffIds } } : {}),
      },
      include: { contact: true },
    }),
    prisma.task.findMany({
      where: {
        dueDate: { gte: qStart, lt: qEnd },
        ...(staffIds.length ? { assigneeId: { in: staffIds } } : {}),
      },
      include: { opportunity: true },
    }),
    contactStageOptions(),
    staffOptions(),
  ]);

  const allEvents: CalEvent[] = [];
  for (const c of contacts) {
    const delivery = c.opportunities.find((o) => o.deliveryDate)?.deliveryDate;
    allEvents.push({
      day: ymd(c.createdAt),
      title: personName(c),
      sub: `Data livrării: ${delivery ? fmtDate(delivery) : EMPTY}`,
      href: `/admin/contact/${c.id}`,
      kind: "client",
    });
  }
  for (const o of deliveries) {
    if (!o.deliveryDate) continue;
    allEvents.push({
      day: ymd(o.deliveryDate),
      title: `Livrare: ${o.name}`,
      sub: o.contact ? personName(o.contact) : "",
      href: `/admin/opportunity/${o.id}`,
      kind: "livrare",
    });
  }
  for (const t of tasks) {
    if (!t.dueDate) continue;
    allEvents.push({
      day: ymd(t.dueDate),
      title: `Sarcină: ${t.name}`,
      sub: t.opportunity?.name ?? "",
      href: `/admin/task/${t.id}`,
      kind: "sarcina",
    });
  }

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d);
  }
  // doar evenimentele care cad efectiv în grilă (interogarea are o zi de rezervă)
  const gridKeys = new Set(days.map(gridKey));
  const events = allEvents.filter((e) => gridKeys.has(e.day));

  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const arr = byDay.get(e.day) ?? [];
    arr.push(e);
    byDay.set(e.day, arr);
  }

  const todayKey = ymdChisinau();
  const prevM = new Date(Date.UTC(y, (m || 1) - 2, 1));
  const nextM = new Date(Date.UTC(y, m || 1, 1));
  const mk = (d: Date) => d.toISOString().slice(0, 7);
  const keepFilters = (extra: string) => {
    const parts = [extra];
    if (sp.stage) parts.push(`stage=${sp.stage}`);
    if (sp.staff) parts.push(`staff=${sp.staff}`);
    return `?${parts.join("&")}`;
  };

  const navBtn =
    "grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-subtle hover:text-foreground";

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="capitalize">{fmtMonthTitle(monthStart)}</span>}
        subtitle={`${events.length} ${events.length === 1 ? "eveniment" : "evenimente"} în această lună`}
        actions={
          <>
            <CalendarFilters
              stages={stages}
              staff={staff}
              currentStage={sp.stage ?? null}
              currentStaff={sp.staff ?? null}
              month={mk(monthStart)}
            />
            <div className="flex items-center overflow-hidden rounded-lg border border-border-strong/70 bg-card shadow-xs">
              <Link href={keepFilters(`m=${mk(prevM)}`)} className={navBtn} title="Luna anterioară">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={keepFilters(`m=${todayKey.slice(0, 7)}`)}
                className="flex h-9 items-center border-x border-border px-3.5 text-[13px] font-medium transition-colors hover:bg-subtle"
              >
                Azi
              </Link>
              <Link href={keepFilters(`m=${mk(nextM)}`)} className={navBtn} title="Luna următoare">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="grid grid-cols-7 border-b border-border bg-subtle/60">
          {["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"].map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium text-muted">
              <span className="hidden md:inline">{d}</span>
              <span className="md:hidden">{d.slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = gridKey(d);
            const inMonth = d.getUTCMonth() === monthStart.getUTCMonth();
            const isToday = key === todayKey;
            const evs = byDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={`min-h-[112px] border-b border-r border-border/70 p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 ${
                  inMonth ? "" : "bg-subtle/50"
                }`}
              >
                <p className="flex justify-end">
                  <span
                    className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums ${
                      isToday
                        ? "bg-lime-brand font-semibold text-create-fg"
                        : inMonth
                          ? "text-foreground/75"
                          : "text-muted/50"
                    }`}
                  >
                    {d.getUTCDate()}
                  </span>
                </p>
                <div className="mt-1 space-y-1">
                  {evs.slice(0, 3).map((e, j) => (
                    <Link
                      key={j}
                      href={e.href}
                      className={`block rounded-md border-l-[3px] px-1.5 py-1 text-[11px] leading-tight text-foreground transition-colors ${KIND_STYLE[e.kind]}`}
                    >
                      <span className="block truncate font-medium">{e.title}</span>
                      {e.sub && <span className="block truncate text-muted">{e.sub}</span>}
                    </Link>
                  ))}
                  {evs.length > 3 && (
                    <p className="px-1.5 text-[11px] font-medium text-muted">+{evs.length - 3} altele</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border bg-subtle/40 px-4 py-2.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-lime-brand ring-1 ring-inset ring-black/10" /> Client nou
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-info" /> Livrare
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-warn" /> Deadline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-foreground/50" /> Sarcină
          </span>
        </div>
      </div>
    </div>
  );
}
