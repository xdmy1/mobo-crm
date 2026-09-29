"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Misc";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveOrganization } from "@/server/actions/settings";

interface OrgData {
  name: string;
  idno: string;
  vatCode: string;
  address: string;
  phone: string;
  email: string;
  iban: string;
  bic: string;
  bankName: string;
  partnerPercent: number;
  designerPercent: number;
  qcDefault: number;
}

export function OrganizationForm({ org }: { org: OrgData }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<OrgData>(org);
  const [saving, setSaving] = useState(false);

  const set =
    (k: keyof OrgData, num = false) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((s) => ({
        ...s,
        [k]: num ? parseFloat(e.target.value) || 0 : e.target.value,
      }));

  async function submit() {
    setSaving(true);
    const res = await saveOrganization(v);
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Setările organizației au fost salvate");
    router.refresh();
  }

  async function uploadPdf(slot: string, file: File) {
    const fd = new FormData();
    fd.append("slot", slot);
    fd.append("file", file);
    const res = await fetch("/api/setup/pdfs", { method: "POST", body: fd });
    if (!res.ok) toast.error("Încărcarea a eșuat");
    else toast.success("PDF încărcat");
  }

  const PdfSlot = ({ slot, label }: { slot: string; label: string }) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm transition-colors hover:border-primary hover:text-primary">
      <span>{label}</span>
      <Upload className="h-4 w-4" />
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadPdf(slot, f);
        }}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight">Organizație / Setarea Companiei</h1>
        <div className="ml-auto">
          <Button onClick={submit} loading={saving}>
            <Save className="h-4 w-4" /> Salvează
          </Button>
        </div>
      </div>

      <Card title="Date firmă">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Denumire" required>
            <Input value={v.name} onChange={set("name")} />
          </Field>
          <Field label="IDNO">
            <Input value={v.idno} onChange={set("idno")} />
          </Field>
          <Field label="Cod TVA">
            <Input value={v.vatCode} onChange={set("vatCode")} />
          </Field>
          <Field label="Adresă">
            <Input value={v.address} onChange={set("address")} />
          </Field>
          <Field label="Telefon">
            <Input value={v.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email">
            <Input value={v.email} onChange={set("email")} />
          </Field>
          <Field label="IBAN">
            <Input value={v.iban} onChange={set("iban")} />
          </Field>
          <Field label="BIC">
            <Input value={v.bic} onChange={set("bic")} />
          </Field>
          <Field label="Banca">
            <Input value={v.bankName} onChange={set("bankName")} />
          </Field>
        </div>
      </Card>

      <Card title="Procente Bord Finanțe [NOU]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Procent partener (%)">
            <Input type="number" value={v.partnerPercent} onChange={set("partnerPercent", true)} />
          </Field>
          <Field label="Procent designer (%)">
            <Input type="number" value={v.designerPercent} onChange={set("designerPercent", true)} />
          </Field>
          <Field label="QC implicit (sumă)">
            <Input type="number" value={v.qcDefault} onChange={set("qcDefault", true)} />
          </Field>
        </div>
      </Card>

      <Card title="Documente PDF (Vizualizare PDF) [NOU]">
        <p className="mb-3 text-sm text-muted">
          Fișierele de mai jos apar în pagina „Vizualizare PDF” din header (Prezentare /
          Ghid, RO / RU).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PdfSlot slot="presentation-ro.pdf" label="Prezentare (RO)" />
          <PdfSlot slot="presentation-ru.pdf" label="Prezentare (RU)" />
          <PdfSlot slot="guide-ro.pdf" label="Ghid (RO)" />
          <PdfSlot slot="guide-ru.pdf" label="Ghid (RU)" />
        </div>
      </Card>
    </div>
  );
}
