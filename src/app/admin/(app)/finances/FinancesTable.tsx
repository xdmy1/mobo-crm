"use client";

// Bord Finanțe (§16). Un rând compact per contract — cât e contractul, cât s-a încasat, cât mai e de
// încasat, profitul — iar detaliile (plăți, costuri de producere, deduceri) se deschid sub rând.
// Celulele editabile se salvează singure la ieșirea din câmp: nu mai există „Modificări nesalvate”.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  Check,
  ChevronRight,
  HandCoins,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { Badge, Empty } from "@/components/ui/Misc";
import { PageHeader, StatCard } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";
import { fmtDate, fmtEur, fmtLei, ymdChisinau } from "@/lib/format";
import { contractStatus } from "@/lib/status";
import {
  addPayment,
  deletePayment,
  saveFinanceRows,
  type FinanceRowInput,
} from "@/server/actions/finances";

export interface PaymentRow {
  id: number;
  /** ISO — se afișează doar prin `fmtDate` */
  date: string;
  amountEur: number;
  method: string | null;
  note: string | null;
}

export interface FinanceRow extends FinanceRowInput {
  number: number;
  status: string;
  /** ISO */
  createdAt: string;
  clientLabel: string;
  /** pagina clientului (sau a persoanei juridice) */
  clientHref: string | null;
  payments: PaymentRow[];
}

const METHODS = ["numerar", "transfer", "card"];
type Filter = "toate" | "datorie" | "achitate";

const inputKeys: Array<keyof FinanceRowInput> = [
  "sinecost",
  "prodPrice",
  "contractSumEur",
  "avans1",
  "avans2",
  "avans3",
  "avansProducere",
  "transaFinalaProducere",
  "procentQc",
  "cadou",
  "reducere",
];

function calc(r: FinanceRow, partnerPercent: number, designerPercent: number, cursEuro: number) {
  const paymentsTotal = r.payments.reduce((s, p) => s + p.amountEur, 0);
  const advances = r.avans1 + r.avans2 + r.avans3;
  const incasat = advances + paymentsTotal;
  const datorieClient = r.contractSumEur - incasat;
  const partener = (r.contractSumEur * partnerPercent) / 100;
  const designer = (r.contractSumEur * designerPercent) / 100;
  // producerea se plătește în lei; sinecostul intră în profit convertit la cursul curent
  const datorieProducere = r.prodPrice - r.avansProducere - r.transaFinalaProducere;
  const sinecostEur = cursEuro > 0 ? r.sinecost / cursEuro : 0;
  const profit = r.contractSumEur - partener - designer - r.procentQc - r.cadou - r.reducere - sinecostEur;
  const progress = r.contractSumEur > 0 ? Math.min(1, Math.max(0, incasat / r.contractSumEur)) : 0;
  return { paymentsTotal, advances, incasat, datorieClient, partener, designer, datorieProducere, sinecostEur, profit, progress };
}

export function FinancesTable({
  rows: initialRows,
  partnerPercent,
  designerPercent,
  cursEuro,
}: {
  rows: FinanceRow[];
  partnerPercent: number;
  designerPercent: number;
  cursEuro: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<FinanceRow[]>(initialRows);
  // după o plată nouă serverul retrimite rândurile: le preluăm, păstrând ce e încă în curs de editare
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>("toate");
  const [savedRow, setSavedRow] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computed = useMemo(
    () => new Map(rows.map((r) => [r.contractId, calc(r, partnerPercent, designerPercent, cursEuro)])),
    [rows, partnerPercent, designerPercent, cursEuro]
  );

  // salvare automată: rândul se trimite la 600ms după ultima modificare
  const update = (contractId: number, key: keyof FinanceRowInput, value: number) => {
    setRows((rs) => {
      const next = rs.map((r) => (r.contractId === contractId ? { ...r, [key]: value } : r));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const row = next.find((r) => r.contractId === contractId)!;
      saveTimer.current = setTimeout(async () => {
        const input = Object.fromEntries(inputKeys.map((k) => [k, row[k]])) as unknown as FinanceRowInput;
        const res = await saveFinanceRows([{ ...input, contractId }]);
        if (!res.ok) toast.error(res.error ?? "Eroare la salvare");
        else {
          setSavedRow(contractId);
          setTimeout(() => setSavedRow((v) => (v === contractId ? null : v)), 1400);
        }
      }, 600);
      return next;
    });
  };

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const totals = rows.reduce(
    (acc, r) => {
      const c = computed.get(r.contractId)!;
      return {
        contract: acc.contract + r.contractSumEur,
        incasat: acc.incasat + c.incasat,
        datorie: acc.datorie + Math.max(0, c.datorieClient),
        profit: acc.profit + c.profit,
      };
    },
    { contract: 0, incasat: 0, datorie: 0, profit: 0 }
  );

  const shown = rows.filter((r) => {
    const d = computed.get(r.contractId)!.datorieClient;
    return filter === "toate" ? true : filter === "datorie" ? d > 0.005 : d <= 0.005;
  });
  const withDebt = rows.filter((r) => computed.get(r.contractId)!.datorieClient > 0.005).length;

  const th = "whitespace-nowrap px-3 py-2 text-xs font-medium text-muted";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bord Finanțe"
        subtitle={`Partener ${partnerPercent}% · Designer ${designerPercent}% · curs ${fmtLei(cursEuro)} / € — configurabile în Setup`}
        actions={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: "toate", label: `Toate ${rows.length}` },
              { value: "datorie", label: `Cu datorie ${withDebt}` },
              { value: "achitate", label: `Achitate ${rows.length - withDebt}` },
            ]}
          />
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Suma contractelor" value={fmtEur(totals.contract)} icon={Wallet} />
        <StatCard
          label="Încasat"
          value={fmtEur(totals.incasat)}
          sub={totals.contract > 0 ? `${Math.round((totals.incasat / totals.contract) * 100)}% din contracte` : undefined}
          icon={Banknote}
          tone="green"
        />
        <StatCard
          label="De încasat"
          value={fmtEur(totals.datorie)}
          sub={withDebt > 0 ? `${withDebt} ${withDebt === 1 ? "contract" : "contracte"} cu datorie` : "totul încasat"}
          icon={HandCoins}
          tone={totals.datorie > 0 ? "red" : "neutral"}
        />
        <StatCard
          label="Profit estimat"
          value={fmtEur(totals.profit)}
          sub={totals.contract > 0 ? `marjă ${Math.round((totals.profit / totals.contract) * 100)}%` : undefined}
          icon={TrendingUp}
          tone={totals.profit >= 0 ? "lime" : "red"}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-subtle/60 text-left">
              <th className="w-8" />
              <th className={th}>Contract</th>
              <th className={th}>Client</th>
              <th className={cn(th, "text-right")}>Suma contract (€)</th>
              <th className={cn(th, "min-w-[220px]")}>Încasat</th>
              <th className={cn(th, "text-right")}>De încasat</th>
              <th className={cn(th, "text-right")}>Profit</th>
              <th className={th}>Ultima plată</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <Empty text={rows.length === 0 ? "Niciun contract încă" : "Niciun contract în acest filtru"} />
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const c = computed.get(r.contractId)!;
              const isOpen = open.has(r.contractId);
              const last = r.payments[0];
              const st = contractStatus(r.status);
              return (
                <RowGroup key={r.contractId}>
                  <tr
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, input, button")) return;
                      toggle(r.contractId);
                    }}
                    className={cn(
                      "cursor-pointer border-b border-border/70 transition-colors hover:bg-subtle/60",
                      isOpen && "bg-subtle/40"
                    )}
                  >
                    <td className="pl-3">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-muted transition-transform duration-200 ease-[var(--ease-out-strong)]",
                          isOpen && "rotate-90"
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold">#{r.number}</span>
                      <span className="ml-2 text-xs text-muted">{fmtDate(r.createdAt)}</span>
                      {st && st.label !== "Semnat" && (
                        <span className="ml-2 inline-block align-middle">
                          <Badge color={st.color}>{st.label}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 font-medium">
                      {r.clientHref ? (
                        <Link href={r.clientHref} className="underline-offset-4 transition-colors hover:text-primary hover:underline">
                          {r.clientLabel}
                        </Link>
                      ) : (
                        r.clientLabel
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <CellInput
                        value={r.contractSumEur}
                        onChange={(v) => update(r.contractId, "contractSumEur", v)}
                        saved={savedRow === r.contractId}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-strong)]",
                              c.progress >= 1 ? "bg-success" : "bg-lime-brand"
                            )}
                            style={{ width: `${c.progress * 100}%` }}
                          />
                          {/* reperele planului de plăți: 50 / 80 / 100 */}
                          {[0.5, 0.8].map((m) => (
                            <span key={m} className="absolute inset-y-0 w-px bg-background/80" style={{ left: `${m * 100}%` }} />
                          ))}
                        </span>
                        <span className="w-[92px] shrink-0 text-right font-medium tabular-nums">{fmtEur(c.incasat)}</span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-semibold tabular-nums",
                        c.datorieClient > 0.005 ? "text-danger" : "text-success"
                      )}
                    >
                      {c.datorieClient > 0.005 ? fmtEur(c.datorieClient) : "achitat"}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", c.profit >= 0 ? "text-success" : "text-danger")}>
                      {fmtEur(c.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {last ? (
                        <>
                          {fmtDate(last.date)} · <span className="tabular-nums text-foreground/80">{fmtEur(last.amountEur)}</span>
                        </>
                      ) : c.advances > 0 ? (
                        "avansuri înregistrate"
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-border/70 last:border-0">
                    <td colSpan={8} className="p-0">
                      <div className="collapse-grid" data-open={isOpen}>
                        <div inert={!isOpen}>
                          {isOpen && (
                            <RowDetail
                              row={r}
                              c={c}
                              partnerPercent={partnerPercent}
                              designerPercent={designerPercent}
                              onChange={(k, v) => update(r.contractId, k, v)}
                              onPaymentsChanged={() => router.refresh()}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ───────────── detaliul unui contract: încasări + costuri & profit ───────────── */

function RowDetail({
  row,
  c,
  partnerPercent,
  designerPercent,
  onChange,
  onPaymentsChanged,
}: {
  row: FinanceRow;
  c: ReturnType<typeof calc>;
  partnerPercent: number;
  designerPercent: number;
  onChange: (key: keyof FinanceRowInput, value: number) => void;
  onPaymentsChanged: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(() => ymdChisinau());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLegacyAdvances = row.avans1 + row.avans2 + row.avans3 > 0;

  async function submitPayment() {
    const amt = parseFloat(amount.replace(",", "."));
    if (!amt) return toast.error("Introduceți suma.");
    setSaving(true);
    const res = await addPayment(row.contractId, { date, amountEur: amt, method, note });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success(`Plată de ${fmtEur(amt)} înregistrată`);
    setAmount("");
    setNote("");
    onPaymentsChanged();
  }

  const label = "text-[11px] font-medium text-muted";
  const money = (n: number, cur: "eur" | "lei" = "eur") => (cur === "eur" ? fmtEur(n) : fmtLei(n));

  return (
    <div className="grid gap-4 border-t border-border/70 bg-subtle/30 px-4 py-4 lg:grid-cols-2 animate-fade-in">
      {/* Încasări */}
      <section className="rounded-lg border border-border bg-card p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[13px] font-semibold">Încasări</h4>
          <span className="text-xs text-muted">
            {fmtEur(c.incasat)} din {fmtEur(row.contractSumEur)} · rămas{" "}
            <b className={c.datorieClient > 0.005 ? "text-danger" : "text-success"}>{fmtEur(Math.max(0, c.datorieClient))}</b>
          </span>
        </div>

        {row.payments.length === 0 && !hasLegacyAdvances ? (
          <p className="py-2 text-[13px] text-muted">Nicio plată încă. Prima tranșă (50%) ar fi {fmtEur(row.contractSumEur * 0.5)}.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {row.payments.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 py-1.5 text-[13px]">
                <span className="w-[82px] tabular-nums text-muted">{fmtDate(p.date)}</span>
                <span className="font-semibold tabular-nums">{fmtEur(p.amountEur)}</span>
                {p.method && <span className="rounded-md bg-foreground/[0.06] px-1.5 text-[11px] text-muted">{p.method}</span>}
                {p.note && <span className="truncate text-xs text-muted">{p.note}</span>}
                <button
                  title="Șterge plata"
                  className="ml-auto grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted opacity-0 transition-[opacity,background-color,color] hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={async () => {
                    const res = await deletePayment(p.id);
                    if (!res.ok) return toast.error(res.error ?? "Eroare");
                    toast.success("Plată ștearsă");
                    onPaymentsChanged();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {hasLegacyAdvances && (
              <li className="py-2 text-xs text-muted">
                Avansuri înregistrate direct pe etape:{" "}
                {[row.avans1, row.avans2, row.avans3].map((a, i) => a > 0 && (
                  <span key={i} className="mr-2 inline-flex items-center gap-1">
                    Etapa {i + 1} <CellInput value={a} onChange={(v) => onChange(`avans${i + 1}` as keyof FinanceRowInput, v)} small />
                  </span>
                ))}
              </li>
            )}
          </ul>
        )}

        {/* adaugă plată — un singur rând, Enter salvează */}
        <div
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/70 pt-3"
          onKeyDown={(e) => e.key === "Enter" && submitPayment()}
        >
          <div>
            <p className={label}>Data</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-[140px] text-[13px]" />
          </div>
          <div>
            <p className={label}>Sumă (€)</p>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={c.datorieClient > 0.005 ? String(Math.round(c.datorieClient * 100) / 100) : "0"}
              className="h-8 w-[110px] text-right text-[13px] tabular-nums"
            />
          </div>
          <div>
            <p className={label}>Metodă</p>
            <div className="flex h-8 gap-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                    method === m ? "border-invert bg-invert text-invert-fg" : "border-border-strong/70 bg-card text-muted hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-[120px] flex-1">
            <p className={label}>Notă</p>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opțional" className="h-8 text-[13px]" />
          </div>
          <Button size="sm" loading={saving} onClick={submitPayment} title="Înregistrează plata (Enter)">
            <Plus className="h-3.5 w-3.5" /> Adaugă
          </Button>
        </div>
      </section>

      {/* Costuri & profit */}
      <section className="rounded-lg border border-border bg-card p-3.5">
        <h4 className="mb-3 text-[13px] font-semibold">Costuri & profit</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          <Cell label="Sinecost (lei)" value={row.sinecost} onChange={(v) => onChange("sinecost", v)} hint={`≈ ${money(c.sinecostEur)}`} />
          <Cell label="Preț producere (lei)" value={row.prodPrice} onChange={(v) => onChange("prodPrice", v)} />
          <Static label="Datorie producere" value={money(c.datorieProducere, "lei")} tone={c.datorieProducere > 0.005 ? "warn" : undefined} />
          <Cell label="Avans producere (lei)" value={row.avansProducere} onChange={(v) => onChange("avansProducere", v)} />
          <Cell label="Tranșa finală producere (lei)" value={row.transaFinalaProducere} onChange={(v) => onChange("transaFinalaProducere", v)} />
          <Cell label="Procent QC (€)" value={row.procentQc} onChange={(v) => onChange("procentQc", v)} />
          <Cell label="Cadou (€)" value={row.cadou} onChange={(v) => onChange("cadou", v)} />
          <Cell label="Reducere (€)" value={row.reducere} onChange={(v) => onChange("reducere", v)} />
          <Static label={`Partener ${partnerPercent}% + designer ${designerPercent}%`} value={money(c.partener + c.designer)} />
        </div>
        <p className="mt-3 border-t border-border/70 pt-2.5 text-xs text-muted">
          Profit = contract − partener − designer − QC − cadou − reducere − sinecost (în €) ={" "}
          <b className={cn("tabular-nums", c.profit >= 0 ? "text-success" : "text-danger")}>{money(c.profit)}</b>
        </p>
      </section>
    </div>
  );
}

function Cell({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted">{label}</p>
      <CellInput value={value} onChange={onChange} wide />
      {hint && <p className="mt-0.5 text-[11px] tabular-nums text-muted/80">{hint}</p>}
    </div>
  );
}

function Static({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted">{label}</p>
      <p className={cn("h-8 leading-8 font-medium tabular-nums", tone === "warn" && "text-warn")}>{value}</p>
    </div>
  );
}

function CellInput({
  value,
  onChange,
  saved,
  small,
  wide,
}: {
  value: number;
  onChange: (v: number) => void;
  /** bifă scurtă „salvat” după salvarea automată */
  saved?: boolean;
  small?: boolean;
  wide?: boolean;
}) {
  return (
    <span className="relative inline-block">
      <input
        type="number"
        step={0.01}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onFocus={(e) => e.target.select()}
        className={cn(
          "no-spinner h-8 rounded-md border border-border bg-subtle/40 px-2 text-right text-[13px] tabular-nums transition-[border-color,box-shadow,background-color] placeholder:text-muted/50 hover:border-border-strong/70 hover:bg-card focus:border-lime-brand focus:bg-card focus:outline-none focus:ring-[3px] focus:ring-lime-brand/25",
          small ? "h-6 w-20 text-xs" : wide ? "w-full" : "w-28",
          saved && "pr-6"
        )}
      />
      {saved && (
        <Check className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-success animate-check-in" strokeWidth={3} />
      )}
    </span>
  );
}
