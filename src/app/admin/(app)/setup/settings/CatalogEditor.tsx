"use client";

// „Administrare Configurație Mobo” — catalogul de prețuri și coeficienți (§19.1).
// MODIFICĂ CATALOG → toate valorile devin editabile → Salvează = versiune nouă.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { fetchBnmRate, saveCatalog } from "@/server/actions/settings";
import {
  FACADE_LABELS,
  MECHANISM_LABELS,
  ORGANIZER_LABELS,
  WORKTOP_LABELS,
  GLASS_LABELS,
  type CalcCatalogData,
  type FacadeMaterial,
  type GlassKind,
  type WorktopMaterial,
} from "@/lib/calc/catalog";

export function CatalogEditor({
  catalog: initial,
  history,
}: {
  catalog: CalcCatalogData;
  history: Array<{ id: number; active: boolean; validFrom: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [c, setC] = useState<CalcCatalogData>(initial);
  const [saving, setSaving] = useState(false);
  const [bnmLoading, setBnmLoading] = useState(false);

  async function pullBnm() {
    setBnmLoading(true);
    const res = await fetchBnmRate();
    setBnmLoading(false);
    if (!res.ok || !res.rate) return toast.error(res.error ?? "Eroare BNM");
    setC((prev) => ({ ...prev, cursEuro: res.rate! }));
    setEditing(true);
    toast.success(
      `Curs BNM din ${res.date}: ${res.rate} MDL/€ — apasă „Salvează catalogul” pentru a-l aplica`
    );
  }

  const V = ({
    value,
    onChange,
    suffix = "MDL",
  }: {
    value: number;
    onChange: (v: number) => void;
    suffix?: string;
  }) =>
    editing ? (
      <input
        type="number"
        step={0.0001}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="no-spinner h-7 w-24 rounded-md border border-border-strong bg-card px-2 text-right text-[13px] tabular-nums shadow-xs focus:border-lime-brand focus:outline-none focus:ring-[3px] focus:ring-lime-brand/25"
      />
    ) : (
      <b>
        {value || "—"}
        {value ? ` ${suffix}` : ""}
      </b>
    );

  async function save() {
    setSaving(true);
    const res = await saveCatalog(c);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Catalog salvat — s-a creat o versiune nouă activă");
    setEditing(false);
    router.refresh();
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5 text-[13px] last:border-0">
      <span className="text-foreground/80">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight">Administrare Configurație Mobo</h1>
        <div className="ml-auto flex gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => { setC(initial); setEditing(false); }}>
                <X className="h-4 w-4" /> Anulează
              </Button>
              <Button onClick={save} loading={saving}>
                <Save className="h-4 w-4" /> Salvează catalogul
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Modifică catalog
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Catalog Prețuri și Coeficienți Producție"
          extra={<Badge color="blue">Activ</Badge>}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Coeficienți multiplicare
          </p>
          {(Object.keys(c.coefficients) as Array<keyof typeof c.coefficients>).map((k) => (
            <Row key={k} label={{ BUCATARIE: "Bucătărie", GARDEROBA: "Garderobă", PIESE_MICI: "Piese mici", DULAP: "Dulap" }[k]}>
              <V
                value={c.coefficients[k]}
                suffix="×"
                onChange={(v) => setC({ ...c, coefficients: { ...c.coefficients, [k]: v } })}
              />
            </Row>
          ))}
          <Row label="Coeficient PREMIUM [NOU]">
            <V value={c.premiumCoefficient} suffix="×" onChange={(v) => setC({ ...c, premiumCoefficient: v })} />
          </Row>
          <Row label="Coeficient adâncime 900mm">
            <V value={c.depth900Coefficient} suffix="×" onChange={(v) => setC({ ...c, depth900Coefficient: v })} />
          </Row>

          <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Prețuri fațadă (m²)
          </p>
          {(Object.keys(c.facadePrices) as FacadeMaterial[]).map((k) => (
            <Row key={k} label={FACADE_LABELS[k]}>
              <V
                value={c.facadePrices[k]}
                onChange={(v) => setC({ ...c, facadePrices: { ...c.facadePrices, [k]: v } })}
              />
            </Row>
          ))}

          <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Prețuri corp (m²) [NOU]
          </p>
          {(["PAL_EGGER", "PAL_KRONO"] as const).map((brand) =>
            (["ALB", "COLOR", "LEMN"] as const).map((fin) => (
              <Row key={`${brand}-${fin}`} label={`${brand === "PAL_EGGER" ? "PAL Egger" : "PAL Krono"} — ${fin.toLowerCase()}`}>
                <V
                  value={c.bodyPrices[brand][fin]}
                  onChange={(v) =>
                    setC({
                      ...c,
                      bodyPrices: {
                        ...c.bodyPrices,
                        [brand]: { ...c.bodyPrices[brand], [fin]: v },
                      },
                    })
                  }
                />
              </Row>
            ))
          )}

          {(["blum", "hettich", "kessebohmer"] as const).map((brand) => (
            <div key={brand}>
              <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Mecanisme {brand === "blum" ? "Blum" : brand === "hettich" ? "Hettich" : "Kessebohmer"}
              </p>
              {Object.keys(c.mechanisms[brand]).map((k) => (
                <Row key={k} label={MECHANISM_LABELS[k] ?? k}>
                  <V
                    value={c.mechanisms[brand][k]}
                    onChange={(v) =>
                      setC({
                        ...c,
                        mechanisms: {
                          ...c.mechanisms,
                          [brand]: { ...c.mechanisms[brand], [k]: v },
                        },
                      })
                    }
                  />
                </Row>
              ))}
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <Card title="Info Calculator">
            <p className="mb-3 rounded-lg border border-lime-brand/50 bg-lime-brand/15 px-3 py-2 text-[13px] text-foreground/80">
              Prețurile de aici sunt direct corelate cu Bordul Tehnic. Orice modificare
              va afecta ofertele noi generate.
            </p>
            <Row label="Curs Euro (MDL/€)">
              <span className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={bnmLoading}
                  onClick={pullBnm}
                  title="Preia cursul oficial de azi de la Banca Națională a Moldovei"
                >
                  <Landmark className="h-3.5 w-3.5" /> Curs BNM
                </Button>
                <V value={c.cursEuro} suffix="MDL" onChange={(v) => setC({ ...c, cursEuro: v })} />
              </span>
            </Row>

            <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Sertare (buc)
            </p>
            {(["blum", "hettich"] as const).map((brand) =>
              (["metal", "lemn"] as const).map((mat) => (
                <Row key={`${brand}-${mat}`} label={`${brand === "blum" ? "Blum" : "Hettich"} ${mat}`}>
                  <V
                    value={c.drawerPrices[brand][mat]}
                    onChange={(v) =>
                      setC({
                        ...c,
                        drawerPrices: {
                          ...c.drawerPrices,
                          [brand]: { ...c.drawerPrices[brand], [mat]: v },
                        },
                      })
                    }
                  />
                </Row>
              ))
            )}

            <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Organizatoare (buc)
            </p>
            {Object.keys(c.organizerPrices).map((k) => (
              <Row key={k} label={ORGANIZER_LABELS[k] ?? k}>
                <V
                  value={c.organizerPrices[k]}
                  onChange={(v) =>
                    setC({ ...c, organizerPrices: { ...c.organizerPrices, [k]: v } })
                  }
                />
              </Row>
            ))}

            <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Blat / Suprafață de lucru (m²) [NOU]
            </p>
            {(Object.keys(c.worktopPrices) as WorktopMaterial[]).map((k) => (
              <Row key={k} label={WORKTOP_LABELS[k]}>
                <V
                  value={c.worktopPrices[k]}
                  onChange={(v) => setC({ ...c, worktopPrices: { ...c.worktopPrices, [k]: v } })}
                />
              </Row>
            ))}

            <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Sticlă / Oglindă per tip (m²) [NOU]
            </p>
            {(Object.keys(GLASS_LABELS) as GlassKind[]).map((k) => (
              <Row key={`g-${k}`} label={`Sticlă ${GLASS_LABELS[k]}`}>
                <V
                  value={c.glassPrices[k]}
                  onChange={(v) => setC({ ...c, glassPrices: { ...c.glassPrices, [k]: v } })}
                />
              </Row>
            ))}
            {(Object.keys(GLASS_LABELS) as GlassKind[]).map((k) => (
              <Row key={`m-${k}`} label={`Oglindă ${GLASS_LABELS[k]}`}>
                <V
                  value={c.mirrorPrices[k]}
                  onChange={(v) => setC({ ...c, mirrorPrices: { ...c.mirrorPrices, [k]: v } })}
                />
              </Row>
            ))}
          </Card>

          <Card title="Istoric versiuni catalog [NOU]">
            <ul className="space-y-1.5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between">
                  <span>Versiunea #{h.id} — din {h.validFrom}</span>
                  {h.active ? <Badge color="green">Activ</Badge> : <Badge>arhivă</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
