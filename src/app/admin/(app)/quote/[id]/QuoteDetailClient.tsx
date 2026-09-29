"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileText, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { QuoteWizard } from "@/components/wizard/QuoteWizard";
import {
  deleteQuote,
  duplicateQuote,
  saveQuoteDiscount,
} from "@/server/actions/quotes";
import type { QuoteConfig } from "@/lib/calc/engine";
import type { CalcCatalogData } from "@/lib/calc/catalog";
import { fmtEur, fmtLei } from "@/lib/format";

export function QuoteActions({
  quoteId,
  opportunityId,
  config,
  catalog,
  whatsapp,
}: {
  quoteId: number;
  opportunityId: number;
  config: QuoteConfig | null;
  catalog: CalcCatalogData;
  /** telefon client + mesaj pre-completat pentru WhatsApp [NOU] */
  whatsapp?: { phone: string | null; message: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="dangerOutline"
        size="icon"
        className="h-9 w-9"
        title="Șterge estimarea"
        aria-label="Șterge"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          setBusy(true);
          const res = await duplicateQuote(quoteId);
          setBusy(false);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else if (res.redirect) {
            toast.success("Estimare duplicată");
            router.push(res.redirect);
          }
        }}
        loading={busy}
      >
        <Copy className="h-4 w-4" /> Duplică
      </Button>
      <Button variant="outline" onClick={() => setWizardOpen(true)}>
        <Pencil className="h-4 w-4" /> Re-editează configurația
      </Button>
      <a href={`/api/pdf/quote/${quoteId}`} target="_blank">
        <Button variant="primary">
          <FileText className="h-4 w-4" /> Printează PDF (Tabel)
        </Button>
      </a>
      {whatsapp && (
        <Button
          variant="create"
          title="Deschide WhatsApp cu mesajul ofertei pre-completat"
          onClick={() => {
            if (!whatsapp.phone) {
              toast.error("Clientul nu are număr de contact salvat.");
              return;
            }
            const phone = whatsapp.phone.replace(/[^\d]/g, "");
            window.open(
              `https://wa.me/${phone}?text=${encodeURIComponent(whatsapp.message)}`,
              "_blank"
            );
          }}
        >
          <MessageCircle className="h-4 w-4" /> Trimite pe WhatsApp
        </Button>
      )}

      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Re-editare configurație"
        width={860}
      >
        {wizardOpen && (
          <QuoteWizard
            opportunityId={opportunityId}
            quoteId={quoteId}
            initialConfig={config}
            catalog={catalog}
            showEditNote
            onClose={() => setWizardOpen(false)}
            onSaved={() => router.refresh()}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          const res = await deleteQuote(quoteId);
          setConfirmOpen(false);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Estimare ștearsă");
            router.push("/admin/quote");
          }
        }}
        title="Șterge estimarea"
        message="Sigur ștergi această estimare? Poate fi restaurată de un administrator."
      />
    </div>
  );
}

export function DiscountPanel({
  quoteId,
  discountEur,
  maxDiscountEur,
  maxDiscountMdl,
  totalAfterMdl,
  totalAfterEur,
}: {
  quoteId: number;
  discountEur: number;
  maxDiscountEur: number;
  maxDiscountMdl: number;
  /** totalul STOCAT al estimării (lei, după reducere) */
  totalAfterMdl: number;
  totalAfterEur?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(discountEur ? String(discountEur) : "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] font-medium">Reducere €</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="no-spinner h-8 w-32 rounded-lg border border-border-strong/70 bg-card px-3 text-right text-[13px] tabular-nums shadow-xs transition-[border-color,box-shadow] focus:border-lime-brand focus:outline-none focus:ring-[3px] focus:ring-lime-brand/25"
          placeholder="0.00"
        />
        <Button
          size="sm"
          loading={saving}
          onClick={async () => {
            setSaving(true);
            const res = await saveQuoteDiscount(quoteId, parseFloat(value) || 0);
            setSaving(false);
            if (!res.ok) toast.error(res.error ?? "Eroare");
            else {
              toast.success("Reducere salvată — prețul a fost recalculat");
              router.refresh();
            }
          }}
        >
          Salvează reducerea
        </Button>
      </div>
      <p className="text-xs text-muted">
        (Maximum −{fmtEur(maxDiscountEur)} / −{fmtLei(maxDiscountMdl)})
      </p>
      <p className="flex items-baseline justify-between gap-3 rounded-lg bg-lime-brand/20 px-3 py-2.5 text-[13px]">
        <span className="text-foreground/80">Total după reducere</span>
        <span className="flex items-baseline gap-2">
          {totalAfterEur != null && (
            <span className="text-xs tabular-nums text-muted">{fmtEur(totalAfterEur)}</span>
          )}
          <b className="text-lg font-semibold tabular-nums tracking-tight">{fmtLei(totalAfterMdl)}</b>
        </span>
      </p>
    </div>
  );
}
