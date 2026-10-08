"use client";

// Sidebar-ul clientului: câmpuri editabile inline, selects cu salvare imediată.
// Etapa NU se mai schimbă de aici — are un singur loc: bara de parcurs din capul fișei (StagePath).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Phone,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { saveRecord, deleteRecords } from "@/server/actions/crud";
import type { SelectOption } from "@/lib/listTypes";
import { ContactComment } from "./ContactComment";

interface ContactData {
  id: number;
  humanId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  comment: string | null;
  idnp: string | null;
  birthDate: string | null;
  deliveryAddress: string | null;
  homeAddress: string | null;
  presentCountry: string | null;
  staffId: number | null;
  stageId: number | null;
  sourceId: number | null;
  /** persoana juridică aleasă la adăugarea lead-ului (null = persoană fizică) */
  company: { id: number; name: string } | null;
}

export function ContactSidebar({
  contact,
  options,
  canDelete,
}: {
  contact: ContactData;
  options: {
    staff: SelectOption[];
    stages: SelectOption[];
    sources: SelectOption[];
    causes: SelectOption[];
  };
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveField(name: string, value: unknown) {
    const res = await saveRecord("contact", contact.id, { [name]: value });
    if (!res.ok) toast.error(res.error ?? "Eroare la salvare");
    else router.refresh();
  }

  if (collapsed) {
    return (
      <div className="shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border-strong/70 bg-card text-muted shadow-xs transition-colors hover:bg-subtle hover:text-foreground"
          title="Expandează panoul"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-full shrink-0 space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-96px)] lg:w-80 lg:overflow-y-auto">
      <div className="flex items-center gap-3">
        <Avatar name={`${contact.firstName} ${contact.lastName}`} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight tracking-tight">
            {contact.firstName} {contact.lastName}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">ID {contact.humanId}</p>
          {contact.company ? (
            <Link
              href={`/admin/company/${contact.company.id}`}
              title="Deschide fișa persoanei juridice"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              <Building2 className="h-3 w-3 shrink-0 text-muted" />
              <span className="truncate">{contact.company.name}</span>
            </Link>
          ) : (
            <p className="mt-1 text-xs text-muted">Persoană fizică</p>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          title="Colapsează panoul"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Acțiuni rapide [NOU] */}
      <div className="flex gap-2">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Phone className="h-3.5 w-3.5" /> Sună
            </Button>
          </a>
        )}
        {contact.phone && (
          <a
            href={`https://wa.me/${contact.phone.replace(/[^\d]/g, "")}`}
            target="_blank"
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
          </a>
        )}
      </div>

      <ContactComment contactId={contact.id} value={contact.comment} />

      <div className="space-y-3 border-t border-border pt-4">
        <SideSelect
          label="Responsabil"
          value={contact.staffId}
          options={options.staff}
          onChange={(v) => saveField("staffId", v)}
        />
        <InlineField label="Prenume" value={contact.firstName} onSave={(v) => saveField("firstName", v)} />
        <InlineField label="Nume" value={contact.lastName} onSave={(v) => saveField("lastName", v)} />
        <InlineField label="Email" value={contact.email} onSave={(v) => saveField("email", v)} />
        <InlineField label="Număr de contact" value={contact.phone} onSave={(v) => saveField("phone", v)} />
        <InlineField label="IDNP" value={contact.idnp} onSave={(v) => saveField("idnp", v)} />
      </div>

      <div className="border-t border-border pt-4">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${detailsOpen ? "" : "-rotate-90"}`}
          />
          Detalii
        </button>
        {detailsOpen && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted">Data nașterii</p>
              <Input
                type="date"
                defaultValue={contact.birthDate?.slice(0, 10) ?? ""}
                onBlur={(e) => saveField("birthDate", e.target.value || null)}
                className="h-8 text-[13px]"
              />
            </div>
            <SideSelect
              label="Sursă"
              value={contact.sourceId}
              options={options.sources}
              onChange={(v) => saveField("sourceId", v)}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Adresă permanentă</p>
        <div className="space-y-3">
          <InlineField
            label="Adresa de livrare"
            value={contact.deliveryAddress}
            onSave={(v) => saveField("deliveryAddress", v)}
          />
          <InlineField
            label="Adresa de domiciliu"
            value={contact.homeAddress}
            onSave={(v) => saveField("homeAddress", v)}
          />
          <InlineField
            label="Țară prezentă"
            value={contact.presentCountry}
            onSave={(v) => saveField("presentCountry", v)}
          />
        </div>
      </div>

      {canDelete && (
        <div className="border-t border-border pt-4">
          <Button
            variant="dangerOutline"
            size="sm"
            className="w-full"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Șterge clientul
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteRecords("contact", [contact.id]);
          setConfirmDelete(false);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Client șters");
            router.push("/admin/contact");
          }
        }}
        title="Șterge clientul"
        message={
          <>
            Sigur ștergi clientul{" "}
            <b>
              {contact.firstName} {contact.lastName}
            </b>
            ? Poate fi restaurat de un administrator.
          </>
        }
      />

    </aside>
  );
}

function InlineField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSave(draft);
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8 text-sm"
          />
          <button
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg bg-invert text-invert-fg transition-colors hover:bg-invert-hover"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            onClick={() => setEditing(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          title="Click pentru editare"
          className="group -mx-2 flex w-[calc(100%+1rem)] cursor-text items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-foreground/[0.05]"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
        >
          <span className="min-w-0 truncate text-[13px] font-medium">
            {value || <span className="font-normal text-muted/70">Adaugă…</span>}
          </span>
          <Pencil className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}

function SideSelect({
  label,
  value,
  options,
  onChange,
  noClear,
}: {
  label: string;
  value: number | null;
  options: SelectOption[];
  onChange: (v: string | null) => void;
  noClear?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <Select
        compact
        value={value != null ? String(value) : null}
        onChange={onChange}
        options={options}
        allowClear={!noClear}
      />
    </div>
  );
}
