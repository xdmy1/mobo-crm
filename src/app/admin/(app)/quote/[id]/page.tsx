import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveCatalog } from "@/lib/calc/getCatalog";
import { fmtDate, fmtDateTime, fmtEur, fmtLei, fmtEurLei, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { Card } from "@/components/ui/Misc";
import { PageHeader } from "@/components/layout/PageHeader";
import type { QuoteConfig } from "@/lib/calc/engine";
import {
  BODY_BRAND_LABELS,
  BODY_FINISH_LABELS,
  FACADE_LABELS,
  FURNITURE_LABELS,
  GLASS_LABELS,
  MECHANISM_LABELS,
  WORKTOP_LABELS,
} from "@/lib/calc/catalog";
import { QuoteActions, DiscountPanel } from "./QuoteDetailClient";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const quoteId = parseInt(id, 10);
  if (isNaN(quoteId)) notFound();

  const [quote, catalog] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, deletedAt: null },
      include: {
        opportunity: { include: { contact: true, room: true } },
        staff: true,
        versions: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { staff: true },
        },
      },
    }),
    getActiveCatalog(),
  ]);
  if (!quote) notFound();

  const cfg = (quote.config ?? null) as QuoteConfig | null;
  // estimare venită din calculatorul site-ului: are propria specificație (vezi /api/public/calculator)
  const siteSpec = ((quote.config ?? null) as {
    _site?: {
      rows: Array<{ label: string; value: string }>;
      breakdown: Array<{ label: string; detail?: string; amount: number }>;
      lang?: string | null;
    };
  } | null)?._site;
  const maxDiscountEur = Math.max(0, quote.offerPriceEur - quote.minPriceEur);
  const maxDiscountMdl = Math.max(0, quote.offerPriceMdl - quote.minPriceMdl);
  // Totalul afișat = cel STOCAT (același ca în listă, pe proiect și în PDF),
  // nu unul recalculat la cursul de azi.
  const totalAfter = quote.totalPrice;
  const totalAfterEur = Math.max(0, quote.offerPriceEur - quote.discountEur);
  const expired = !!quote.expirationDate && quote.expirationDate <= new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: `/admin/opportunity/${quote.opportunityId}`, label: "Vezi proiectul" }}
        title={quote.opportunity.name}
        subtitle={
          quote.opportunity.contact ? (
            <>
              Estimare tehnică · Client:{" "}
              <Link
                href={`/admin/contact/${quote.opportunity.contact.id}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {personName(quote.opportunity.contact)}
              </Link>{" "}
              · {quote.name}
            </>
          ) : (
            <>Estimare tehnică · {quote.name}</>
          )
        }
        actions={
        <QuoteActions
          quoteId={quote.id}
          opportunityId={quote.opportunityId}
          config={cfg}
          catalog={catalog}
          whatsapp={{
            phone: quote.opportunity.contact?.phone ?? null,
            message: [
              `Bună ziua${quote.opportunity.contact ? `, ${quote.opportunity.contact.firstName}` : ""}! 👋`,
              ``,
              `Vă trimitem estimarea Mobo kitchens & home pentru proiectul „${quote.opportunity.name}”:`,
              `• Preț ofertă: ${fmtLei(totalAfter)} (≈ ${fmtEur(totalAfterEur)})`,
              quote.expirationDate
                ? `• Oferta este valabilă până la ${fmtDate(quote.expirationDate)}.`
                : "",
              ``,
              `Rămânem la dispoziție pentru orice întrebare!`,
            ]
              .filter(Boolean)
              .join("\n"),
          }}
        />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Informație Estimare">
          <dl className="space-y-2 text-sm">
            <Row k="Nume estimare" v={quote.name} />
            <Row k="Responsabil" v={personName(quote.staff)} />
            <Row k="Data estimării" v={fmtDate(quote.quoteDate)} />
            <Row k="Data expirării" v={fmtDate(quote.expirationDate)} />
            <Row k="Stare" v={quote.active ? (expired ? "Activă · expirată" : "Activă") : "Inactivă"} />
          </dl>
        </Card>

        <Card title="Rezumatul prețurilor">
          <dl className="space-y-2 text-sm">
            <Row
              k="Preț minim €"
              v={fmtEurLei(quote.minPriceEur, quote.minPriceMdl)}
            />
            <Row
              k="Preț de ofertare €"
              v={fmtEurLei(quote.offerPriceEur, quote.offerPriceMdl)}
            />
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <DiscountPanel
              quoteId={quote.id}
              discountEur={quote.discountEur}
              maxDiscountEur={maxDiscountEur}
              maxDiscountMdl={maxDiscountMdl}
              totalAfterMdl={totalAfter}
              totalAfterEur={totalAfterEur}
            />
          </div>
        </Card>
      </div>

      {siteSpec && (
        <Card title="Specificația clientului — calculatorul de pe mobo.md">
          <p className="mb-3 text-[13px] text-muted">
            Exact ce a ales și ce preț a văzut vizitatorul pe site
            {siteSpec.lang ? ` (a completat în ${siteSpec.lang === "ru" ? "rusă" : "română"})` : ""}.
          </p>
          <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            {siteSpec.rows.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 text-[13px]">
                <span className="shrink-0 text-muted">{r.label}</span>
                <span className="text-right font-medium">{r.value}</span>
              </div>
            ))}
          </div>
          {siteSpec.breakdown.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              {siteSpec.breakdown.map((b, i) => (
                <div key={i} className="flex items-baseline gap-4 border-b border-border/70 px-3 py-2 text-[13px] last:border-0">
                  <span className="w-44 shrink-0 font-medium">{b.label}</span>
                  <span className="min-w-0 flex-1 text-muted">{b.detail}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtLei(b.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="Configurație tehnică">
        {!cfg || siteSpec ? (
          <p className="text-sm text-muted">
            Fără configurație — estimare creată automat (ex. cerere de pe site).
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TechCard label="Tip" value={cfg.furnitureType ? FURNITURE_LABELS[cfg.furnitureType] : EMPTY} />
            <TechCard label="Mod" value={cfg.qualityLevel ?? EMPTY} />
            <TechCard
              label="Dimensiuni"
              value={`${cfg.lengthMm ? (cfg.lengthMm / 1000).toFixed(1) : EMPTY}m × ${
                cfg.heightMm ? (cfg.heightMm / 1000).toFixed(1) : EMPTY
              }m (A: ${cfg.depth ?? EMPTY}mm)`}
            />
            <TechCard
              label="Corp"
              value={
                cfg.bodyBrand
                  ? `${BODY_BRAND_LABELS[cfg.bodyBrand]} – ${cfg.bodyFinish ? BODY_FINISH_LABELS[cfg.bodyFinish] : EMPTY}`
                  : EMPTY
              }
            />
            <TechCard label="Fațadă" value={cfg.facade ? FACADE_LABELS[cfg.facade] : EMPTY} />
            {cfg.drawers.length > 0 && (
              <TechCard
                label="Sertare"
                value={cfg.drawers
                  .map((d) => `${d.brand} ${d.material} ×${d.qty}`)
                  .join(", ")}
              />
            )}
            {cfg.mechanisms.length > 0 && (
              <TechCard
                label="Mecanisme"
                value={cfg.mechanisms
                  .map((m) => `${MECHANISM_LABELS[m.key] ?? m.key} ×${m.qty}`)
                  .join(", ")}
              />
            )}
            {(cfg.glass || cfg.mirror) && (
              <TechCard
                label="Sticlă / Oglindă"
                value={[
                  cfg.glass
                    ? `Sticlă ${GLASS_LABELS[cfg.glass.kind]} ${cfg.glass.lMm}×${cfg.glass.hMm}`
                    : null,
                  cfg.mirror
                    ? `Oglindă ${GLASS_LABELS[cfg.mirror.kind]} ${cfg.mirror.lMm}×${cfg.mirror.hMm}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("; ")}
              />
            )}
            {cfg.worktop && (
              <TechCard
                label="Blat"
                value={`${WORKTOP_LABELS[cfg.worktop.material]} — ${cfg.worktop.sqm} m²`}
              />
            )}
            {cfg.organizers.length > 0 && (
              <TechCard
                label="Organizatoare"
                value={cfg.organizers.map((o) => `${o.key} ×${o.qty}`).join(", ")}
              />
            )}
          </div>
        )}
      </Card>

      {/* Istoric versiuni [NOU] */}
      {quote.versions.length > 0 && (
        <Card title="Istoric versiuni" flush>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-subtle/60 text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Modificat de</th>
                <th className="px-4 py-2 text-right font-medium">Preț minim</th>
                <th className="px-4 py-2 text-right font-medium">Ofertare</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.versions.map((v) => {
                const p = v.prices as {
                  minPriceMdl?: number;
                  offerPriceMdl?: number;
                  totalMdl?: number;
                };
                return (
                  <tr key={v.id} className="border-b border-border/70 last:border-0 hover:bg-subtle/60">
                    <td className="px-4 py-2 tabular-nums">{fmtDateTime(v.createdAt)}</td>
                    <td className="px-4 py-2">
                      {personName(v.staff)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{fmtLei(p.minPriceMdl)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{fmtLei(p.offerPriceMdl)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtLei(p.totalMdl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2 last:border-0 last:pb-0">
      <dt className="text-[13px] text-muted">{k}</dt>
      <dd className="text-right text-[13px] font-medium tabular-nums">{v}</dd>
    </div>
  );
}

function TechCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-subtle/60 px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium">{value}</p>
    </div>
  );
}
