import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtMonthTitle, ymdChisinau } from "@/lib/format";
import { personName } from "@/lib/people";
import {
  staffOptions,
  taskTypeOptions,
  taskStatusOptions,
  taskPriorityOptions,
  contactOptions,
  opportunityOptions,
} from "@/server/options";
import { CalendarFilters } from "./CalendarFilters";
import { PlanButton } from "./PlanButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";

export const metadata = { title: "Calendar — MOBO CRM" };
export const dynamic = "force-dynamic";

/**
 * Calendarul arată doar ce e planificat cu adevărat: sarcinile cu dată (întâlnire, contractare, măsurare,
 * livrare, apel…) și termenul de livrare promis clientului în fișa proiectului. Clienții noi (lead-urile)
 * nu mai apar aici — adăugarea unui lead nu e un eveniment.
 */
type Tone = "intalnire" | "contractare" | "masurare" | "livrare" | "apel" | "sarcina" | "termen";

interface CalEvent {
  day: string; // YYYY-MM-DD
  title: string;
  sub: string;
  href: string;
  tone: Tone;
  done?: boolean;
}

const TONE_STYLE: Record<Tone, string> = {
  intalnire: "border-l-[#9aa80c] bg-lime-brand/25 hover:bg-lime-brand/40",
  contractare: "border-l-success bg-success/[0.12] hover:bg-success/20",
  masurare: "border-l-warn bg-warn/[0.13] hover:bg-warn/20",
  livrare: "border-l-info bg-info/10 hover:bg-info/[0.17]",
  apel: "border-l-foreground/50 bg-foreground/[0.06] hover:bg-foreground/10",
  sarcina: "border-l-foreground/50 bg-foreground/[0.06] hover:bg-foreground/10",
  termen: "border-l-info border-dashed bg-info/[0.05] hover:bg-info/10",
};

const TONE_SWATCH: Record<Tone, string> = {
  intalnire: "bg-lime-brand ring-1 ring-inset ring-black/10",
  contractare: "bg-success",
  masurare: "bg-warn",
  livrare: "bg-info",
  apel: "bg-foreground/50",
  sarcina: "bg-foreground/50",
  termen: "border border-dashed border-info",
};

/** Tonul unei sarcini după numele tipului (fără diacritice, ca să prindă și variantele scrise din Setup). */
function toneOf(typeName?: string | null): Tone {
  const n = (typeName ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("intaln") || n.includes("meeting")) return "intalnire";
  if (n.includes("contract")) return "contractare";
  if (n.includes("masur")) return "masurare";
  if (n.includes("livr")) return "livrare";
  if (n.includes("apel")) return "apel";
  return "sarcina";
}

/** Ziua unui moment real (termen, livrare) — în fusul Chișinău, nu al serverului. */
const ymd = (d: Date): string => ymdChisinau(d);

/** Celulele grilei sunt date calendaristice pure, ținute la miezul nopții UTC. */
const gridKey = (d: Date): string => d.toISOString().slice(0, 10);

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
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

  const typeIds = sp.type ? sp.type.split(",").map(Number).filter(Boolean) : [];
  const staffIds = sp.staff ? sp.staff.split(",").map(Number).filter(Boolean) : [];

  const [tasks, deliveries, types, staff, statuses, priorities, contacts, opportunities] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          dueDate: { gte: qStart, lt: qEnd },
          ...(typeIds.length ? { typeId: { in: typeIds } } : {}),
          ...(staffIds.length ? { assigneeId: { in: staffIds } } : {}),
        },
        include: {
          type: true,
          status: true,
          opportunity: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.opportunity.findMany({
        where: {
          deletedAt: null,
          deliveryDate: { gte: qStart, lt: qEnd },
          ...(staffIds.length ? { staffId: { in: staffIds } } : {}),
        },
        include: { contact: { select: { firstName: true, lastName: true } } },
      }),
      taskTypeOptions(),
      staffOptions(),
      taskStatusOptions(),
      taskPriorityOptions(),
      contactOptions(),
      opportunityOptions(),
    ]);

  // filtrul pe tip ascunde termenele din proiecte, cu excepția tipului „Livrare”
  const showTerms =
    typeIds.length === 0 ||
    types.some((t) => typeIds.includes(Number(t.value)) && toneOf(t.label) === "livrare");

  const allEvents: CalEvent[] = [];
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const who = t.opportunity?.name ?? (t.contact ? personName(t.contact) : "");
    allEvents.push({
      day: ymd(t.dueDate),
      title: t.name,
      sub: [t.type?.name, who].filter(Boolean).join(" · "),
      href: `/admin/task/${t.id}`,
      tone: toneOf(t.type?.name),
      done: t.status?.name === "done",
    });
  }
  if (showTerms) {
    for (const o of deliveries) {
      if (!o.deliveryDate) continue;
      allEvents.push({
        day: ymd(o.deliveryDate),
        title: `Termen livrare: ${o.name}`,
        sub: o.contact ? `${personName(o.contact)} · promis clientului` : "promis clientului",
        href: `/admin/opportunity/${o.id}`,
        tone: "termen",
      });
    }
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
    if (sp.type) parts.push(`type=${sp.type}`);
    if (sp.staff) parts.push(`staff=${sp.staff}`);
    return `?${parts.join("&")}`;
  };
  const requestedDay = sp.new && /^\d{4}-\d{2}-\d{2}$/.test(sp.new) ? sp.new : null;

  // tipul implicit la „Planifică”: Întâlnire, dacă există
  const defaultType = types.find((t) => toneOf(t.label) === "intalnire") ?? types[0];
  const legend = [
    ...types.map((t) => ({ label: t.label, tone: toneOf(t.label) })),
    { label: "Termen livrare (din proiect)", tone: "termen" as Tone },
  ];

  const navBtn =
    "grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-subtle hover:text-foreground";

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="capitalize">{fmtMonthTitle(monthStart)}</span>}
        subtitle={
          events.length === 0
            ? "Nimic planificat în această lună"
            : `${events.length} ${events.length === 1 ? "eveniment planificat" : "evenimente planificate"} în această lună`
        }
        actions={
          <>
            <CalendarFilters
              types={types}
              staff={staff}
              currentType={sp.type ?? null}
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
            <PlanButton
              options={{ staff, types, contacts, opportunities }}
              defaults={{
                userId: String(user.id),
                typeId: defaultType?.value,
                statusId: statuses[0]?.value,
                priorityId: priorities[Math.floor((priorities.length - 1) / 2)]?.value,
              }}
              today={todayKey}
              requestedDay={requestedDay}
              clearHref={`/admin/calendar${keepFilters(`m=${mk(monthStart)}`)}`}
            />
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
                className={cn(
                  "group min-h-[112px] border-b border-r border-border/70 p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                  !inMonth && "bg-subtle/50"
                )}
              >
                <p className="flex items-center justify-between">
                  <Link
                    href={keepFilters(`m=${mk(monthStart)}&new=${key}`)}
                    title="Planifică în această zi"
                    aria-label={`Planifică pe ${key}`}
                    className="grid h-6 w-6 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-subtle hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                  <span
                    className={cn(
                      "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums",
                      isToday
                        ? "bg-lime-brand font-semibold text-create-fg"
                        : inMonth
                          ? "text-foreground/75"
                          : "text-muted/50"
                    )}
                  >
                    {d.getUTCDate()}
                  </span>
                </p>
                <div className="mt-1 space-y-1">
                  {evs.slice(0, 3).map((e, j) => (
                    <Link
                      key={j}
                      href={e.href}
                      className={cn(
                        "block rounded-md border-l-[3px] px-1.5 py-1 text-[11px] leading-tight text-foreground transition-colors",
                        TONE_STYLE[e.tone],
                        e.done && "opacity-55"
                      )}
                    >
                      <span className={cn("block truncate font-medium", e.done && "line-through")}>{e.title}</span>
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
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <i className={cn("inline-block h-2.5 w-2.5 rounded-[3px]", TONE_SWATCH[l.tone])} /> {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
