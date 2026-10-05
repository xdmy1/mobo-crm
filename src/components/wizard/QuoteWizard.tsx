"use client";

// Wizard-ul „Estimare tehnică” — 13 pași (12 originali + „Organizatoare” [NOU]).
// Calculul rulează live cu motorul partajat (src/lib/calc/engine).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  computeQuote,
  validateStep,
  EMPTY_CONFIG,
  type QuoteConfig,
} from "@/lib/calc/engine";
import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  FURNITURE_LABELS,
  GLASS_LABELS,
  MECHANISM_LABELS,
  ORGANIZER_LABELS,
  WORKTOP_LABELS,
  type CalcCatalogData,
  type FacadeMaterial,
  type GlassKind,
} from "@/lib/calc/catalog";
import { saveQuoteFromWizard } from "@/server/actions/quotes";
import { fmtNumber, fmtLei, fmtEur } from "@/lib/format";
import {
  DRAWER_LABELS,
  DRAWER_PHOTOS,
  MECHANISM_PHOTOS,
  OptionPictogram,
  hasPictogram,
  organizerPictogram,
  type OptionPhoto,
} from "./optionArt";

const STEP_TITLES = [
  "NIVEL CALITATE",
  "TIP MOBILIER",
  "DIMENSIUNI",
  "MATERIAL CORP",
  "MATERIAL FAȚADĂ",
  "STICLĂ & OGLINZI",
  "SERTARE",
  "MECANISME — BLUM",
  "MECANISME — HETTICH",
  "MECANISME — KESSEBOHMER",
  "ORGANIZATOARE",
  "SUPRAFAȚĂ LUCRU",
  "PREȚ FINAL",
];
const TOTAL_STEPS = STEP_TITLES.length;

// pasul intern (1..13) → pasul de validare din engine (1..12)
const VALIDATION_STEP: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 99, 12: 11, 13: 12,
};

export function QuoteWizard({
  opportunityId,
  quoteId = null,
  initialConfig,
  catalog,
  onSaved,
  onClose,
  showEditNote,
}: {
  opportunityId: number;
  quoteId?: number | null;
  initialConfig?: QuoteConfig | null;
  catalog: CalcCatalogData;
  onSaved?: (id: number) => void;
  onClose?: () => void;
  showEditNote?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<QuoteConfig>({
    ...EMPTY_CONFIG,
    ...(initialConfig ?? {}),
    drawers: initialConfig?.drawers ?? [],
    mechanisms: initialConfig?.mechanisms ?? [],
    organizers: initialConfig?.organizers ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [glassOpen, setGlassOpen] = useState(!!(initialConfig?.glass || initialConfig?.mirror));

  const result = useMemo(() => computeQuote(config, catalog), [config, catalog]);

  const patch = (p: Partial<QuoteConfig>) => {
    setConfig((c) => ({ ...c, ...p }));
    setError(null);
  };

  // pașii cu o singură alegere (nivel, tip mobilier…) trec singuri mai departe:
  // alegi → vezi bifa o clipă → ești la pasul următor. Scutește un click la fiecare pas.
  const pickAndGo = (p: Partial<QuoteConfig>) => {
    patch(p);
    setTimeout(() => setStep((s) => Math.min(TOTAL_STEPS, s + 1)), 280);
  };

  function next() {
    const v = validateStep(VALIDATION_STEP[step] ?? 99, config);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  async function save() {
    setSaving(true);
    const res = await saveQuoteFromWizard(opportunityId, quoteId, config);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Eroare la salvare");
      return;
    }
    toast.success(quoteId ? "Estimarea a fost actualizată" : "Estimare salvată în CRM");
    onClose?.();
    if (res.id) onSaved?.(res.id);
    if (res.redirect && !onSaved) router.push(res.redirect);
    router.refresh();
  }

  const progress = (step / TOTAL_STEPS) * 100;

  const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
  const summary: Array<{ label: string; value: string | null; step: number }> = [
    { label: "Nivel", value: config.qualityLevel, step: 1 },
    { label: "Tip", value: config.furnitureType ? FURNITURE_LABELS[config.furnitureType] : null, step: 2 },
    {
      label: "Dimensiuni",
      value:
        config.lengthMm && config.heightMm
          ? `${fmtNumber(config.lengthMm / 1000)} × ${fmtNumber(config.heightMm / 1000)} m`
          : null,
      step: 3,
    },
    {
      label: "Corp",
      value: config.bodyBrand
        ? `${BODY_BRAND_LABELS[config.bodyBrand]}${config.bodyFinish ? ` · ${BODY_FINISH_LABELS[config.bodyFinish]}` : ""}`
        : null,
      step: 4,
    },
    { label: "Fațadă", value: config.facade ? FACADE_LABELS[config.facade] : null, step: 5 },
    { label: "Sertare", value: count(config.drawers.length, "linie", "linii"), step: 7 },
    { label: "Mecanisme", value: count(config.mechanisms.length, "poziție", "poziții"), step: 8 },
    { label: "Organizatoare", value: count(config.organizers.length, "poziție", "poziții"), step: 11 },
    {
      label: "Blat",
      value: config.worktop ? `${WORKTOP_LABELS[config.worktop.material]} · ${config.worktop.sqm} m²` : null,
      step: 12,
    },
  ];

  return (
    <div className="flex flex-col">
      {showEditNote && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-[13px] text-primary">
          Notă: Modificările salvate vor actualiza estimarea. Prețul și reducerea vor fi
          recalculate.
        </div>
      )}

      {/* progres */}
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
        <div
          className="h-full rounded-full bg-create transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-subtle/60 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime-brand text-sm font-semibold text-create-fg ring-1 ring-inset ring-black/10">
          {step}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">
            Pas {step} din {TOTAL_STEPS}
          </p>
          <p className="truncate text-[15px] font-semibold capitalize tracking-tight">{STEP_TITLES[step - 1].toLowerCase()}</p>
        </div>
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          {STEP_TITLES.map((_, i) => (
            <button
              key={i}
              onClick={() => i + 1 < step && setStep(i + 1)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i + 1 < step
                  ? "bg-create cursor-pointer"
                  : i + 1 === step
                    ? "bg-primary"
                    : "bg-foreground/20"
              }`}
              title={STEP_TITLES[i]}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_248px] lg:items-start">
      {/* conținut pas — fiecare pas intră lin, ca schimbarea să nu fie o „tăietură” */}
      <div key={step} className="min-h-[280px] min-w-0 animate-page-in">
        {step === 1 && (
          <CardGrid
            options={[
              { key: "STANDARD", label: "STANDARD", img: "/wizard/standard.jpg" },
              { key: "PREMIUM", label: "PREMIUM", img: "/wizard/premium.jpg" },
            ]}
            value={config.qualityLevel}
            onSelect={(v) => pickAndGo({ qualityLevel: v as QuoteConfig["qualityLevel"] })}
            large
          />
        )}

        {step === 2 && (
          <CardGrid
            options={Object.entries(FURNITURE_LABELS).map(([key, label]) => ({
              key,
              label: label.toUpperCase(),
              img: `/wizard/${key.toLowerCase()}.jpg`,
            }))}
            value={config.furnitureType}
            onSelect={(v) => pickAndGo({ furnitureType: v as QuoteConfig["furnitureType"] })}
          />
        )}

        {step === 3 && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
            <div className="space-y-4">
              <NumField
                label="Lungime (mm)"
                required
                value={config.lengthMm}
                onChange={(v) => patch({ lengthMm: v, depth: config.depth ?? 900 })}
                placeholder="3000"
              />
              <NumField
                label="Înălțime (mm)"
                required
                value={config.heightMm}
                onChange={(v) => patch({ heightMm: v })}
                placeholder="2400"
              />
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-foreground/85">Adâncime</p>
                <div className="grid grid-cols-2 gap-2">
                  {([600, 900] as const).map((d) => {
                    const active = config.depth === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => patch({ depth: d })}
                        className={`flex h-11 cursor-pointer items-center justify-between rounded-lg border bg-card px-3 text-left shadow-xs transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.98] ${
                          active
                            ? "border-lime-brand ring-[3px] ring-lime-brand/35"
                            : "border-border-strong/70 hover:border-foreground/40"
                        }`}
                      >
                        <span>
                          <span className="block text-[14px] font-semibold tabular-nums">{d} mm</span>
                          <span className="block text-[11px] text-muted">{d === 600 ? "standard" : "adânc"}</span>
                        </span>
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                            active ? "border-transparent bg-create text-create-fg ring-1 ring-black/10" : "border-border-strong text-transparent"
                          }`}
                        >
                          <Check className={`h-3 w-3 ${active ? "animate-check-in" : ""}`} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DimensionSketch lengthMm={config.lengthMm} heightMm={config.heightMm} depth={config.depth} facadeArea={result.facadeArea} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <Divider label="BRAND PAL CORP" />
              <CardGrid
                options={[
                  { key: "PAL_EGGER", label: "PAL EGGER" },
                  { key: "PAL_KRONO", label: "PAL KRONO" },
                ]}
                value={config.bodyBrand}
                onSelect={(v) => patch({ bodyBrand: v as QuoteConfig["bodyBrand"] })}
                compact
              />
            </div>
            <div>
              <Divider label="FINISAJ *" />
              <CardGrid
                options={[
                  { key: "ALB", label: "ALB" },
                  { key: "COLOR", label: "COLOR" },
                  { key: "LEMN", label: "LEMN" },
                ]}
                value={config.bodyFinish}
                onSelect={(v) => patch({ bodyFinish: v as QuoteConfig["bodyFinish"] })}
                compact
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <CardGrid
            options={(Object.keys(FACADE_LABELS) as FacadeMaterial[]).map((key) => ({
              key,
              label: FACADE_LABELS[key].toUpperCase(),
              sub: `${catalog.facadePrices[key]} MDL/m²`,
            }))}
            value={config.facade}
            onSelect={(v) => patch({ facade: v as FacadeMaterial })}
            compact
          />
        )}

        {step === 6 && (
          <div className="space-y-4">
            <button
              onClick={() => {
                if (glassOpen) {
                  setGlassOpen(false);
                  patch({ glass: null, mirror: null });
                } else setGlassOpen(true);
              }}
              className={`w-full cursor-pointer rounded-lg border border-dashed px-4 py-3 text-[13px] font-medium transition-colors ${
                glassOpen
                  ? "border-lime-brand bg-lime-brand/15 text-foreground"
                  : "border-border-strong text-muted hover:border-foreground/40 hover:bg-subtle/60 hover:text-foreground"
              }`}
            >
              {glassOpen ? "Elimină sticlă / oglindă" : "+ Adaugă sticlă / oglindă"}
            </button>
            {glassOpen && (
              <div className="grid gap-4 md:grid-cols-2">
                <GlassBlock
                  title="STICLĂ"
                  value={config.glass}
                  onChange={(g) => patch({ glass: g })}
                />
                <GlassBlock
                  title="OGLINDĂ"
                  value={config.mirror}
                  onChange={(g) => patch({ mirror: g })}
                />
              </div>
            )}
          </div>
        )}

        {step === 7 && (
          <OptionGrid>
            {(["blum", "hettich"] as const).flatMap((brand) =>
              (["metal", "lemn"] as const).map((mat) => {
                const id = `${brand}-${mat}`;
                const qty = config.drawers.find((d) => d.brand === brand && d.material === mat)?.qty ?? 0;
                const same = (d: QuoteConfig["drawers"][number]) => d.brand === brand && d.material === mat;
                return (
                  <OptionCard
                    key={id}
                    label={DRAWER_LABELS[id]}
                    price={catalog.drawerPrices[brand][mat]}
                    photo={DRAWER_PHOTOS[id]}
                    qty={qty}
                    onQty={(q) =>
                      patch({
                        drawers:
                          q <= 0
                            ? config.drawers.filter((d) => !same(d))
                            : qty === 0
                              ? [...config.drawers, { brand, material: mat, qty: q }]
                              : config.drawers.map((d) => (same(d) ? { ...d, qty: q } : d)),
                      })
                    }
                  />
                );
              })
            )}
          </OptionGrid>
        )}

        {(step === 8 || step === 9 || step === 10) && (
          <MechanismStep
            brand={step === 8 ? "blum" : step === 9 ? "hettich" : "kessebohmer"}
            config={config}
            catalog={catalog}
            onChange={(mechanisms) => patch({ mechanisms })}
            excludeKeys={step === 8 ? ["piston_gaz"] : []}
            includePiston={step === 8}
          />
        )}

        {step === 11 && (
          <OptionGrid>
            {Object.entries(ORGANIZER_LABELS).map(([key, label]) => {
              const qty = config.organizers.find((o) => o.key === key)?.qty ?? 0;
              return (
                <OptionCard
                  key={key}
                  label={label}
                  price={catalog.organizerPrices[key] ?? 0}
                  pictogram={organizerPictogram(key)}
                  qty={qty}
                  onQty={(q) =>
                    patch({
                      organizers:
                        q <= 0
                          ? config.organizers.filter((o) => o.key !== key)
                          : qty === 0
                            ? [...config.organizers, { key, qty: q }]
                            : config.organizers.map((o) => (o.key === key ? { ...o, qty: q } : o)),
                    })
                  }
                />
              );
            })}
          </OptionGrid>
        )}

        {step === 12 && (
          <div className="space-y-4">
            <CardGrid
              options={Object.entries(WORKTOP_LABELS).map(([key, label]) => ({
                key,
                label: label.toUpperCase(),
                sub: `${catalog.worktopPrices[key as keyof typeof catalog.worktopPrices]} MDL/m²`,
              }))}
              value={config.worktop?.material ?? null}
              onSelect={(v) =>
                patch({
                  worktop: {
                    material: v as NonNullable<QuoteConfig["worktop"]>["material"],
                    sqm: config.worktop?.sqm ?? 0,
                  },
                })
              }
              compact
            />
            {config.worktop && (
              <NumField
                label="Metri pătrați (m²)"
                required
                value={config.worktop.sqm || null}
                onChange={(v) =>
                  patch({ worktop: { ...config.worktop!, sqm: v ?? 0 } })
                }
                placeholder="3"
                step={0.1}
              />
            )}
          </div>
        )}

        {step === 13 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-lime-brand/60 bg-lime-brand/15 px-6 py-7 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                Preț final estimat
              </p>
              <p className="mt-2 text-5xl font-semibold leading-none tracking-tight tabular-nums">
                {/* aceeași cifră ca `fmtLei`, doar unitatea e stilizată separat */}
                {fmtLei(result.totalMdl).replace(/\s*lei$/, "")}{" "}
                <span className="text-xl font-medium text-muted">lei</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                ≈ {fmtEur(result.totalEur)} · Curs {fmtNumber(catalog.cursEuro, 4)} lei/€
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <label className="text-sm font-medium">Reducere manuală:</label>
              <input
                type="number"
                min={0}
                value={config.manualDiscountMdl || ""}
                onChange={(e) =>
                  patch({ manualDiscountMdl: parseFloat(e.target.value) || 0 })
                }
                className="no-spinner w-32 rounded-lg border border-border bg-card px-3 py-1.5 text-right text-sm focus:border-primary focus:outline-none"
                placeholder="0"
              />
              <span className="text-sm text-muted">lei</span>
            </div>
            {result.maxDiscountMdl > 0 && (
              <p className="text-center text-xs text-muted">
                Maximum {fmtLei(result.maxDiscountMdl)} ({fmtEur(result.maxDiscountEur)})
              </p>
            )}

            {/* Breakdown pe componente [NOU] */}
            {result.breakdown.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-subtle/60 text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">Componentă</th>
                      <th className="px-3 py-2 font-medium">Detalii</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((b, i) => (
                      <tr key={i} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-1.5 font-medium">{b.label}</td>
                        <td className="px-3 py-1.5 text-muted">{b.detail}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtLei(b.amountMdl)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-subtle/60 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Cost producție (Preț minim)
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtLei(result.minPriceMdl)}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Preț de ofertare (coef. ×
                        {config.furnitureType ? catalog.coefficients[config.furnitureType] : 1}
                        {config.qualityLevel === "PREMIUM"
                          ? ` × ${catalog.premiumCoefficient} premium`
                          : ""}
                        )
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtLei(result.offerPriceMdl)}</td>
                    </tr>
                    <tr className="text-primary font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Marjă estimată
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtLei(result.marginMdl)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rezumatul configurației — mereu la vedere: ce ai ales până acum și cât costă.
          Un click pe un rând te duce la pasul lui, fără „Înapoi” de zece ori. */}
      <aside className="rounded-xl border border-border bg-subtle/50 p-3.5 lg:sticky lg:top-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Configurația ta</p>
        <ul className="mt-2 space-y-0.5">
          {summary.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(row.step);
                }}
                title={`Mergi la pasul „${row.label}”`}
                className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-foreground/[0.06] ${
                  row.step === step ? "bg-foreground/[0.06]" : ""
                }`}
              >
                <span className="shrink-0 text-muted">{row.label}</span>
                <span className={`min-w-0 break-words text-right font-medium ${row.value ? "" : "text-muted/60"}`}>
                  {row.value ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Total curent</p>
          <p key={result.totalMdl} className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight tabular-nums animate-total-bump">
            {fmtLei(result.totalMdl)}
          </p>
          <p className="text-xs tabular-nums text-muted">{fmtEur(result.totalEur)}</p>
        </div>
      </aside>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-danger/[0.07] px-3 py-2 text-sm font-medium text-danger">
          ⚠ {error}
        </p>
      )}

      {/* navigare */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => {
            setError(null);
            setStep((s) => Math.max(1, s - 1));
          }}
        >
          <ChevronLeft className="h-4 w-4" /> Înapoi
        </Button>
        {/* pe ecrane late totalul stă deja, mare, în rezumatul din dreapta */}
        <p className="text-sm text-muted lg:hidden">
          Total curent:{" "}
          {/* totalul „tresare” scurt când se schimbă, ca omul să vadă efectul alegerii */}
          <b key={result.totalMdl} className="inline-block text-foreground tabular-nums animate-total-bump">
            {fmtLei(result.totalMdl)}
          </b>
        </p>
        {step < TOTAL_STEPS ? (
          <Button onClick={next}>
            Înainte <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Salvează în CRM
          </Button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── sub-componente ───────────────────────── */

function ImgPlaceholder({
  label,
  className = "",
  src,
}: {
  label?: string;
  className?: string;
  src?: string;
}) {
  return (
    <div
      className={`grid place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-foreground/[0.07] to-foreground/[0.14] ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span className="select-none text-[11px] font-bold tracking-[0.2em] text-black/30">
          MOBO DESIGN
        </span>
      )}
    </div>
  );
}

function CardGrid({
  options,
  value,
  onSelect,
  compact,
  large,
  cols,
}: {
  options: Array<{ key: string; label: string; sub?: string; img?: string }>;
  value: string | null;
  onSelect: (v: string) => void;
  compact?: boolean;
  large?: boolean;
  cols?: number;
}) {
  // Tailwind generează doar clasele scrise literal — nu `lg:grid-cols-${cols}`
  const COLS: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  };
  // cardurile compacte își iau lățimea de care are nevoie textul — numele și prețul se văd întregi
  const grid = compact
    ? "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
    : cols
      ? COLS[cols] ?? COLS[4]
      : large
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  return (
    <div className={`grid gap-3 ${grid}`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onSelect(o.key)}
            className={`relative cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.985] ${
              active
                ? "border-lime-brand ring-[3px] ring-lime-brand/35"
                : "border-border-strong/70 hover:border-foreground/40 hover:shadow-sm"
            }`}
          >
            {active && !compact && (
              <span className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-create text-create-fg shadow ring-1 ring-black/10 animate-check-in">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
            {!compact && (
              <ImgPlaceholder className={large ? "aspect-[2/1] max-h-[300px] w-full" : "aspect-[4/3] w-full"} src={o.img} />
            )}
            <div className={`flex items-center gap-2 px-3 ${compact ? "py-2.5" : "py-2.5"}`}>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] font-semibold leading-snug">{o.label}</p>
                {o.sub && <p className="mt-0.5 break-words text-xs text-muted">{o.sub}</p>}
              </div>
              {compact && (
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                    active
                      ? "border-transparent bg-create text-create-fg ring-1 ring-black/10"
                      : "border-border-strong bg-card text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Schiță la scară a corpului de mobilier: se redesenează pe măsură ce omul tastează.
 * Nu e decorativ — arată imediat o greșeală de tastare (o bucătărie de 12 cm se vede).
 */
function DimensionSketch({
  lengthMm,
  heightMm,
  depth,
  facadeArea,
}: {
  lengthMm: number | null;
  heightMm: number | null;
  depth: 600 | 900 | null;
  facadeArea: number;
}) {
  const L = lengthMm && lengthMm > 0 ? lengthMm : null;
  const H = heightMm && heightMm > 0 ? heightMm : null;
  // pânza: 320×220; corpul ocupă cel mult 240×160, păstrând proporția; adâncimea = o fațetă oblică
  const W = 320;
  const HH = 220;
  const maxW = 230;
  const maxH = 150;
  const ratio = L && H ? L / H : 1.5;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }
  w = Math.max(w, 24);
  h = Math.max(h, 24);
  const d = depth === 900 ? 30 : 20; // fațeta de adâncime, în px
  const x0 = (W - w - d) / 2;
  const y0 = (HH - h + d) / 2;
  const empty = !L || !H;
  const fmtM = (mm: number) => `${fmtNumber(mm / 1000)} m`;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-subtle/50 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Schiță la scară</p>
      <svg viewBox={`0 0 ${W} ${HH}`} className="mt-2 w-full max-w-[380px] self-center" aria-hidden>
        {/* podeaua */}
        <line x1="12" y1={HH - 14} x2={W - 12} y2={HH - 14} className="stroke-border-strong" strokeWidth="1" strokeDasharray="3 4" />
        {empty ? (
          <text x={W / 2} y={HH / 2} textAnchor="middle" className="fill-muted text-[12px]">
            Completează lungimea și înălțimea
          </text>
        ) : (
          <g className="transition-transform duration-300 ease-[var(--ease-out-strong)]">
            {/* laterala (adâncimea) */}
            <polygon
              points={`${x0 + w},${y0} ${x0 + w + d},${y0 - d} ${x0 + w + d},${y0 + h - d} ${x0 + w},${y0 + h}`}
              className="fill-foreground/[0.14] stroke-foreground/50"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* blatul */}
            <polygon
              points={`${x0},${y0} ${x0 + d},${y0 - d} ${x0 + w + d},${y0 - d} ${x0 + w},${y0}`}
              className="fill-lime-brand/40 stroke-foreground/50"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* fațada, împărțită în module de ~600 mm */}
            <rect x={x0} y={y0} width={w} height={h} rx="2" className="fill-card stroke-foreground/70" strokeWidth="1.4" />
            {Array.from({ length: Math.max(0, Math.round((L ?? 0) / 600) - 1) }, (_, i) => {
              const x = x0 + ((i + 1) * w) / Math.round((L ?? 0) / 600);
              return <line key={i} x1={x} y1={y0 + 3} x2={x} y2={y0 + h - 3} className="stroke-foreground/25" strokeWidth="1" />;
            })}
            {/* cote */}
            <text x={x0 + w / 2} y={y0 + h + 16} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
              {fmtM(L!)}
            </text>
            <text
              x={x0 - 8}
              y={y0 + h / 2}
              textAnchor="middle"
              transform={`rotate(-90 ${x0 - 8} ${y0 + h / 2})`}
              className="fill-foreground text-[11px] font-medium"
            >
              {fmtM(H!)}
            </text>
            {depth && (
              <text x={x0 + w + d + 6} y={y0 + h / 2 - d / 2} className="fill-muted text-[10px]">
                {depth} mm
              </text>
            )}
          </g>
        )}
      </svg>
      <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-2.5 text-[12px]">
        <span className="text-muted">Suprafață fațadă</span>
        <b key={facadeArea} className="tabular-nums animate-total-bump">{facadeArea > 0 ? `${fmtNumber(facadeArea)} m²` : "—"}</b>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function NumField({
  label,
  required,
  value,
  onChange,
  placeholder,
  step = 1,
}: {
  label: string;
  required?: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium">
        {required && <span className="text-danger">* </span>}
        {label}
      </label>
      <input
        type="number"
        min={0}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-lime-brand focus:outline-none focus:ring-[3px] focus:ring-lime-brand/25"
      />
    </div>
  );
}

/** Grila de carduri cu imagine pentru sertare, mecanisme și organizatoare. */
function OptionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-3">{children}</div>;
}

/**
 * Card cu fotografie (sau schița mișcării) + cantitate. Click pe imagine = încă o bucată,
 * ca la alegerea dintr-un catalog; cardul ales e conturat lime și arată câte bucăți are.
 */
function OptionCard({
  label,
  price,
  photo,
  pictogram,
  qty,
  onQty,
}: {
  label: string;
  price: number;
  photo?: OptionPhoto;
  pictogram?: string;
  qty: number;
  onQty: (q: number) => void;
}) {
  const active = qty > 0;
  const stepBtn =
    "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border-strong/70 bg-card transition-[border-color,background-color,transform] duration-150 hover:border-foreground/40 active:scale-90";
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 ${
        active ? "border-lime-brand ring-[3px] ring-lime-brand/35" : "border-border-strong/70 hover:border-foreground/40"
      }`}
    >
      <button
        type="button"
        onClick={() => onQty(qty + 1)}
        title={`Adaugă o bucată — ${label}`}
        className="group relative block aspect-[4/3] w-full cursor-pointer overflow-hidden bg-subtle"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={label}
            loading="lazy"
            style={{ objectPosition: photo.pos }}
            className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03]"
          />
        ) : pictogram && hasPictogram(pictogram) ? (
          <OptionPictogram kind={pictogram} className="h-full w-full p-3 text-foreground/75" />
        ) : null}
        {active && (
          <span className="absolute right-2 top-2 rounded-full bg-create px-2 py-0.5 text-xs font-semibold tabular-nums text-create-fg shadow ring-1 ring-black/10 animate-check-in">
            {qty} buc
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex-1">
          <p className="break-words text-[13px] font-semibold leading-snug">{label}</p>
          <p className="mt-0.5 text-xs text-muted">{price > 0 ? `${price} MDL/buc` : "Fără preț în catalog"}</p>
        </div>
        {active ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onQty(qty - 1)} title="O bucată mai puțin" className={stepBtn}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-6 flex-1 text-center text-[13px] font-semibold tabular-nums">{qty}</span>
            <button type="button" onClick={() => onQty(qty + 1)} title="Încă o bucată" className={stepBtn}>
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onQty(0)}
              title="Scoate din estimare"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-danger transition-[background-color,transform] duration-150 hover:bg-danger/10 active:scale-90"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onQty(1)}
            className="flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-border-strong/70 bg-card text-[13px] font-medium shadow-xs transition-[border-color,background-color,transform] duration-150 hover:border-foreground/40 hover:bg-subtle active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" /> Adaugă
          </button>
        )}
      </div>
    </div>
  );
}

function MechanismStep({
  brand,
  config,
  catalog,
  onChange,
  includePiston,
}: {
  brand: "blum" | "hettich" | "kessebohmer";
  config: QuoteConfig;
  catalog: CalcCatalogData;
  onChange: (m: QuoteConfig["mechanisms"]) => void;
  excludeKeys?: string[];
  includePiston?: boolean;
}) {
  const keys = Object.keys(catalog.mechanisms[brand]).filter((k) =>
    includePiston ? true : k !== "piston_gaz"
  );
  const same = (m: QuoteConfig["mechanisms"][number], key: string) => m.brand === brand && m.key === key;
  return (
    <OptionGrid>
      {keys.map((key) => {
        const qty = config.mechanisms.find((m) => same(m, key))?.qty ?? 0;
        return (
          <OptionCard
            key={key}
            label={MECHANISM_LABELS[key] ?? key}
            price={catalog.mechanisms[brand][key] ?? 0}
            photo={MECHANISM_PHOTOS[key]}
            pictogram={key}
            qty={qty}
            onQty={(q) =>
              onChange(
                q <= 0
                  ? config.mechanisms.filter((m) => !same(m, key))
                  : qty === 0
                    ? [...config.mechanisms, { brand, key, qty: q }]
                    : config.mechanisms.map((m) => (same(m, key) ? { ...m, qty: q } : m))
              )
            }
          />
        );
      })}
    </OptionGrid>
  );
}

function GlassBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: QuoteConfig["glass"];
  onChange: (g: QuoteConfig["glass"]) => void;
}) {
  const kinds = Object.keys(GLASS_LABELS) as GlassKind[];
  return (
    <div
      className={`rounded-xl border p-4 transition-[border-color,box-shadow] ${
        value ? "border-lime-brand ring-[3px] ring-lime-brand/25" : "border-border-strong/70"
      }`}
    >
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) =>
            onChange(e.target.checked ? { kind: "SIMPLA", lMm: 0, hMm: 0 } : null)
          }
          className="h-4 w-4 accent-[var(--invert)]"
        />
        {title}
      </label>
      {value && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => onChange({ ...value, kind: k })}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  value.kind === k
                    ? "border-lime-brand bg-lime-brand/20"
                    : "border-border-strong/70 hover:border-foreground/40"
                }`}
              >
                {GLASS_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="L (mm)"
              value={value.lMm || null}
              onChange={(v) => onChange({ ...value, lMm: v ?? 0 })}
            />
            <NumField
              label="H (mm)"
              value={value.hMm || null}
              onChange={(v) => onChange({ ...value, hMm: v ?? 0 })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
