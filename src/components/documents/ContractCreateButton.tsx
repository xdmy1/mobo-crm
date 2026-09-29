"use client";

// Drawerele de documente: Contract, Predat/Preluat, Ofertă.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileCheck2, FileHeart, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { Field, Input, Checkbox } from "@/components/ui/Input";
import { Select, MultiSelect } from "@/components/ui/Select";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { useToast } from "@/components/ui/Toast";
import {
  createContract,
  createHandover,
  createOffer,
} from "@/server/actions/documents";
import { contractDefaults } from "@/server/actions/assist";
import { fmtEur } from "@/lib/format";
import type { SelectOption } from "@/lib/listTypes";

export interface ScopedOption extends SelectOption {
  contactId: number | null;
}

const LANGS = [
  { value: "RO", label: "RO" },
  { value: "RU", label: "RU" },
];

export function ContractCreateButton({
  contacts,
  companies = [],
  rooms,
  opportunities,
  fixedContactId,
  label = "Creează Contract",
  variant = "outline",
}: {
  contacts: SelectOption[];
  companies?: SelectOption[];
  rooms: ScopedOption[] | SelectOption[];
  opportunities: ScopedOption[] | SelectOption[];
  fixedContactId?: number;
  label?: string;
  variant?: "create" | "outline" | "primary";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(
    fixedContactId ? String(fixedContactId) : null
  );
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [oppIds, setOppIds] = useState<string[]>([]);
  const [retribution, setRetribution] = useState("");
  const [guarantee, setGuarantee] = useState("15");
  const [beneficiary, setBeneficiary] = useState("15");
  const [language, setLanguage] = useState<string | null>("RO");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState<number | null>(null);

  // camerele, proiectele și prețul clientului sunt deja în sistem → vin completate, omul doar verifică
  async function prefill(forContactId: string | null) {
    setPrefilled(null);
    if (!forContactId) return;
    const d = await contractDefaults(parseInt(forContactId, 10));
    if (!d) return;
    setRoomIds(d.roomIds);
    setOppIds(d.opportunityIds);
    if (d.retributionEur > 0) {
      setRetribution(String(d.retributionEur));
      setPrefilled(d.retributionEur);
    }
  }

  const scopedRooms = useMemo(
    () =>
      (rooms as ScopedOption[]).filter(
        (r) => !contactId || r.contactId == null || String(r.contactId) === contactId
      ),
    [rooms, contactId]
  );
  const scopedOpps = useMemo(
    () =>
      (opportunities as ScopedOption[]).filter(
        (o) => !contactId || o.contactId == null || String(o.contactId) === contactId
      ),
    [opportunities, contactId]
  );

  async function submit() {
    if (!contactId && !companyId) {
      setErr("Selectați clientul sau persoana juridică.");
      return;
    }
    if (!retribution.trim()) {
      setErr("Introduceți retribuția (prețul).");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const res = await createContract({
        contactId,
        companyId,
        roomIds,
        opportunityIds: oppIds,
        retribution,
        financialGuarantee: guarantee,
        beneficiaryPercent: beneficiary,
        language: language ?? "RO",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Eroare");
        return;
      }
      toast.success("Contract generat");
      if (res.downloadUrl) window.open(res.downloadUrl, "_blank");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Eroare la generarea contractului. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setOpen(true);
          prefill(contactId);
        }}
      >
        <Plus className="h-4 w-4" /> {label}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Creează Contract"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Închide
            </Button>
            <Button onClick={submit} loading={loading}>
              <FilePlus2 className="h-4 w-4" /> Generează PDF
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nume client" required={!companyId}>
            <Select
              value={contactId}
              onChange={(v) => {
                setContactId(v);
                setRoomIds([]);
                setOppIds([]);
                prefill(v);
              }}
              options={contacts}
              disabled={!!fixedContactId}
              placeholder="Selectează clientul…"
            />
          </Field>
          {companies.length > 0 && !fixedContactId && (
            <Field label="sau Persoană juridică">
              <Select
                value={companyId}
                onChange={setCompanyId}
                options={companies}
                placeholder="Selectează persoana juridică…"
              />
            </Field>
          )}
          <Field label="Camere contact" required>
            <MultiSelect
              values={roomIds}
              onChange={setRoomIds}
              options={scopedRooms}
              placeholder="Selectează camerele…"
            />
          </Field>
          <Field label="Proiecte" required>
            <MultiSelect
              values={oppIds}
              onChange={setOppIds}
              options={scopedOpps}
              placeholder="Selectează proiectele…"
            />
          </Field>
          <Field label="Retribuție (preț)" required>
            <Input
              value={retribution}
              onChange={(e) => {
                setRetribution(e.target.value);
                setPrefilled(null);
              }}
              placeholder="5000 (cinci mii)"
            />
            {prefilled != null && (
              <p className="flex items-center gap-1.5 text-xs text-muted animate-fade-in">
                <Sparkles className="h-3 w-3 text-primary" />
                Completat din estimările active ale clientului ({fmtEur(prefilled)}) — îl poți schimba.
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Garanția financiară (%)" required>
              <Input
                type="number"
                value={guarantee}
                onChange={(e) => setGuarantee(e.target.value)}
                placeholder="15"
              />
            </Field>
            <Field label="Procente beneficiar (%)" required>
              <Input
                type="number"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="15"
              />
            </Field>
          </div>
          <Field label="Limbă contract" required>
            <Select value={language} onChange={setLanguage} options={LANGS} allowClear={false} />
          </Field>
          {err && <p className="text-sm text-danger">⚠ {err}</p>}
        </div>
      </Drawer>
    </>
  );
}

export function HandoverCreateButton({
  contacts,
  rooms,
  opportunities,
  fixedContactId,
  defaultIdnp,
  variant = "outline",
}: {
  contacts: SelectOption[];
  rooms: ScopedOption[];
  opportunities: ScopedOption[];
  fixedContactId?: number;
  defaultIdnp?: string | null;
  variant?: "create" | "outline" | "primary";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(
    fixedContactId ? String(fixedContactId) : null
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [oppIds, setOppIds] = useState<string[]>([]);
  const [idnp, setIdnp] = useState(defaultIdnp ?? "");
  const [language, setLanguage] = useState<string | null>("RO");
  const [signature, setSignature] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scopedRooms = useMemo(
    () => rooms.filter((r) => !contactId || String(r.contactId) === contactId),
    [rooms, contactId]
  );
  const scopedOpps = useMemo(
    () => opportunities.filter((o) => !contactId || String(o.contactId) === contactId),
    [opportunities, contactId]
  );

  async function submit() {
    if (!contactId) return setErr("Selectați clientul.");
    if (!roomId) return setErr("Selectați camera clientului.");
    if (!idnp.trim()) return setErr("Introduceți IDNP-ul.");
    setErr(null);
    setLoading(true);
    try {
      const res = await createHandover({
        contactId,
        roomId,
        opportunityIds: oppIds,
        idnp,
        language: language ?? "RO",
        signature,
      });
      if (!res.ok) return toast.error(res.error ?? "Eroare");
      toast.success(
        signature
          ? "Document Predat/Preluat generat și SEMNAT"
          : "Document Predat/Preluat generat"
      );
      if (res.downloadUrl) window.open(res.downloadUrl, "_blank");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Eroare la generarea documentului. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Creează Predat/Preluat Document
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Creează Predat/Preluat Document"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Închide
            </Button>
            <Button onClick={submit} loading={loading}>
              <FileCheck2 className="h-4 w-4" /> Generează DOC
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Client" required>
            <Select
              value={contactId}
              onChange={(v) => {
                setContactId(v);
                setRoomId(null);
                setOppIds([]);
              }}
              options={contacts}
              disabled={!!fixedContactId}
            />
          </Field>
          <Field label="Camera clientului" required>
            <Select value={roomId} onChange={setRoomId} options={scopedRooms} />
          </Field>
          <Field label="Proiecte" required>
            <MultiSelect values={oppIds} onChange={setOppIds} options={scopedOpps} />
          </Field>
          <Field label="IDNP" required>
            <Input
              value={idnp}
              onChange={(e) => setIdnp(e.target.value)}
              placeholder="Introduceți IDNP-ul"
            />
          </Field>
          <Field label="Limba">
            <Select value={language} onChange={setLanguage} options={LANGS} allowClear={false} />
          </Field>
          <Field
            label="Semnătura clientului (tabletă)"
            help="Opțional — semnătura desenată aici apare direct în documentul DOCX generat, iar procesul-verbal e marcat ca SEMNAT"
          >
            <SignaturePad onChange={setSignature} />
          </Field>
          {err && <p className="text-sm text-danger">⚠ {err}</p>}
        </div>
      </Drawer>
    </>
  );
}

export function OfferCreateButton({
  contacts,
  rooms,
  fixedContactId,
  variant = "outline",
}: {
  contacts: SelectOption[];
  rooms: ScopedOption[];
  fixedContactId?: number;
  variant?: "create" | "outline" | "primary";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(
    fixedContactId ? String(fixedContactId) : null
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showStagePrices, setShowStagePrices] = useState(true);
  const [language, setLanguage] = useState("RO");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scopedRooms = useMemo(
    () => rooms.filter((r) => !contactId || String(r.contactId) === contactId),
    [rooms, contactId]
  );

  async function submit() {
    if (!contactId) return setErr("Selectați clientul.");
    if (!roomId) return setErr("Selectați camera.");
    setErr(null);
    setLoading(true);
    try {
      const res = await createOffer({
        contactId,
        roomId,
        showStagePrices,
        language,
      });
      if (!res.ok) return toast.error(res.error ?? "Eroare");
      toast.success("Ofertă generată");
      if (res.downloadUrl) window.open(res.downloadUrl, "_blank");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Eroare la generarea ofertei. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Creează Ofertă
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Creează Ofertă"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Închide
            </Button>
            <Button onClick={submit} loading={loading}>
              <FileHeart className="h-4 w-4" /> Creează PDF
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Client" required>
            <Select
              value={contactId}
              onChange={(v) => {
                setContactId(v);
                setRoomId(null);
              }}
              options={contacts}
              disabled={!!fixedContactId}
            />
          </Field>
          <Field label="Cameră" required>
            <Select
              value={roomId}
              onChange={setRoomId}
              options={scopedRooms}
              placeholder="Selectați camera"
            />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground/70">Opțiuni PDF</p>
            <Checkbox
              checked={showStagePrices}
              onChange={setShowStagePrices}
              label="Afișează prețuri per etapă în PDF"
            />
          </div>
          <Field label="Selectează limba" required>
            <div className="flex gap-4">
              {LANGS.map((l) => (
                <label key={l.value} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    checked={language === l.value}
                    onChange={() => setLanguage(l.value)}
                    className="h-4 w-4 accent-[var(--invert)]"
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </Field>
          {err && <p className="text-sm text-danger">⚠ {err}</p>}
        </div>
      </Drawer>
    </>
  );
}
