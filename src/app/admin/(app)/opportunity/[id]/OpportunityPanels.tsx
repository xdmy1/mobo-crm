"use client";

// Cele 8 panouri ale paginii de proiect (§12.1), inclusiv Bord Tehnic inline.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, ClipboardList, Download, Info, Mail, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Collapse } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { FormDrawer } from "@/components/form/FormDrawer";
import { QuoteWizard } from "@/components/wizard/QuoteWizard";
import { saveRecord, deleteRecords } from "@/server/actions/crud";
import { SimpleTable, type PanelRow } from "../../contact/[id]/ContactPanels";
import type { FormConfig, SelectOption } from "@/lib/listTypes";
import type { CalcCatalogData } from "@/lib/calc/catalog";

interface OppData {
  id: number;
  name: string;
  description: string | null;
  nextStep: string | null;
  competitors: string | null;
  startDate: string | null;
  closeDate: string | null;
  deliveryDate: string | null;
  sinecost: number | null;
  stageId: number | null;
  typeId: number | null;
  sourceId: number | null;
  productionSequenceId: number | null;
  roomName: string | null;
  roomId: number | null;
  contactId: number | null;
  createdAt: string;
}

export function OpportunityPanels({
  opportunity: opp,
  options,
  quoteRows,
  attach2D,
  attach3D,
  attachSpec,
  attachOther,
  taskRows,
  noteRows,
  catalog,
  defaults,
}: {
  opportunity: OppData;
  /** valori precompletate în formulare: utilizatorul curent și responsabilul clientului */
  defaults: { currentUserId: string; reportToId: string | null };
  options: {
    staff: SelectOption[];
    stages: SelectOption[];
    types: SelectOption[];
    sources: SelectOption[];
    prodSeq: SelectOption[];
    taskTypes: SelectOption[];
    taskStatuses: SelectOption[];
    taskPriorities: SelectOption[];
  };
  quoteRows: PanelRow[];
  attach2D: PanelRow[];
  attach3D: PanelRow[];
  attachSpec: PanelRow[];
  attachOther: PanelRow[];
  taskRows: PanelRow[];
  noteRows: PanelRow[];
  catalog: CalcCatalogData;
}) {
  const router = useRouter();
  const toast = useToast();
  const [attachDrawer, setAttachDrawer] = useState<null | "PROIECT2D" | "PROIECT3D" | "SPECIFICATII" | "ATASAMENT">(null);
  const [taskOpen, setTaskOpen] = useState(false);
  // venit din „Proiect nou” (?wizard=1): Bordul Tehnic e deja deschis, fără alt click
  const startWithWizard = useSearchParams().get("wizard") === "1";
  const [wizardVisible, setWizardVisible] = useState(startWithWizard);
  // după fiecare salvare wizard-ul pornește curat — altfel al doilea click pe „Salvează” crea o estimare dublă
  const [wizardRun, setWizardRun] = useState(0);
  const wizardRef = useRef<HTMLDivElement>(null);
  // venit cu ?wizard=1 → pagina coboară singură la Bordul Tehnic
  useEffect(() => {
    if (!startWithWizard) return;
    // salt direct (fără animație): pagina abia s-a încărcat, nu e nimic de „urmărit” cu privirea
    const t = setTimeout(() => wizardRef.current?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(t);
  }, [startWithWizard]);
  const openWizard = () => {
    setWizardVisible(true);
    requestAnimationFrame(() =>
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };
  const [del, setDel] = useState<{ entity: string; row: PanelRow } | null>(null);
  const [fileTab, setFileTab] = useState<"Toate" | "2D" | "3D" | "Specificații" | "Altele">("Toate");
  const [noteOpen, setNoteOpen] = useState(false);

  // mesaje inline
  const [noteTitle, setNoteTitle] = useState("");
  const [noteRecipient, setNoteRecipient] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  async function saveField(name: string, value: unknown) {
    const res = await saveRecord("opportunity", opp.id, { [name]: value });
    if (!res.ok) toast.error(res.error ?? "Eroare");
    else router.refresh();
  }

  const attachForm = (type: string): FormConfig => ({
    title:
      type === "PROIECT2D"
        ? "Adaugă proiect 2D"
        : type === "PROIECT3D"
          ? "Adaugă proiect 3D"
          : type === "SPECIFICATII"
            ? "Adaugă specificații"
            : "Adaugă fișier",
    entity: "attachment",
    fields: [
      { name: "files", label: "Atașare", type: "file", required: true },
      {
        name: "reportToId",
        label: "Raportează managerului",
        type: "select",
        required: true,
        options: options.staff,
        defaultValue: defaults.reportToId ?? defaults.currentUserId,
        help: "Persoana care primește notificarea",
      },
      {
        name: "type",
        label: "Tipul atașamentului",
        type: "select",
        required: true,
        defaultValue: type,
        options: [
          { value: "ATASAMENT", label: "Atașament" },
          { value: "PROIECT2D", label: "2D" },
          { value: "PROIECT3D", label: "3D" },
          { value: "SPECIFICATII", label: "Specificații" },
          { value: "MASURARI", label: "Măsurări" },
        ],
      },
      { name: "name", label: "Nume (opțional)", type: "text" },
    ],
  });

  const taskForm: FormConfig = {
    title: "Creează Sarcină",
    entity: "task",
    fields: [
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "description", label: "Descriere", type: "textarea" },
      // precompletat: de regulă îți creezi singur sarcina, e „de făcut” și are prioritate medie
      { name: "assigneeId", label: "Responsabil (asignat)", type: "select", options: options.staff, defaultValue: defaults.currentUserId },
      { name: "typeId", label: "Tip", type: "select", options: options.taskTypes },
      { name: "statusId", label: "Statusul", type: "select", options: options.taskStatuses, defaultValue: options.taskStatuses[0]?.value },
      {
        name: "priorityId",
        label: "Prioritate",
        type: "select",
        options: options.taskPriorities,
        defaultValue: options.taskPriorities[Math.floor((options.taskPriorities.length - 1) / 2)]?.value,
      },
      { name: "dueDate", label: "Termen", type: "date" },
    ],
  };

  async function saveNote() {
    if (!noteTitle.trim()) return toast.error("Titlul este obligatoriu.");
    setNoteSaving(true);
    const res = await saveRecord("note", null, {
      title: noteTitle,
      body: noteBody,
      recipientId: noteRecipient,
      opportunityId: String(opp.id),
    });
    setNoteSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Mesaj creat");
    setNoteOpen(false);
    setNoteTitle("");
    setNoteBody("");
    setNoteRecipient(null);
    router.refresh();
  }

  const files = [
    ...attach2D.map((r) => ({ ...r, kind: "2D" as const })),
    ...attach3D.map((r) => ({ ...r, kind: "3D" as const })),
    ...attachSpec.map((r) => ({ ...r, kind: "Specificații" as const })),
    ...attachOther.map((r) => ({ ...r, kind: "Altele" as const })),
  ];
  const shownFiles = fileTab === "Toate" ? files : files.filter((f) => f.kind === fileTab);
  const FILE_TYPE = {
    Toate: "ATASAMENT",
    "2D": "PROIECT2D",
    "3D": "PROIECT3D",
    Specificații: "SPECIFICATII",
    Altele: "ATASAMENT",
  } as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_372px] xl:items-start">
      {/* ───────── coloana de lucru: estimări, calculator, sarcini, mesaje ───────── */}
      <div className="min-w-0 space-y-4">
        <Collapse
          title="Estimări"
          icon={<Calculator className="h-4 w-4 text-muted" />}
          defaultOpen
          count={quoteRows.length}
          extra={
            <Button
              size="sm"
              variant={quoteRows.length === 0 ? "create" : "outline"}
              onClick={openWizard}
              title="Deschide calculatorul și configurează o estimare nouă pentru acest proiect"
            >
              <Plus className="h-4 w-4" /> Estimare nouă
            </Button>
          }
        >
          {quoteRows.length === 0 ? (
            <p className="py-2 text-[13px] text-muted">
              Proiectul nu are încă o estimare. Configureaz-o în calculatorul de mai jos — prețul apare pe loc,
              iar clientul trece singur la etapa „Calcule”.
            </p>
          ) : (
            <SimpleTable
              head={["Nume", "Data estimării", "Data expirării", "Data creării"]}
              rows={quoteRows}
              onDelete={(row) => setDel({ entity: "quoteRow", row })}
            />
          )}
        </Collapse>

        <div ref={wizardRef} className="scroll-mt-20">
          <Collapse
            title="Bord Tehnic — calculator"
            icon={<Calculator className="h-4 w-4 text-muted" />}
            open={wizardVisible}
            onOpenChange={setWizardVisible}
          >
            <QuoteWizard
              key={wizardRun}
              opportunityId={opp.id}
              catalog={catalog}
              onSaved={() => {
                setWizardRun((n) => n + 1);
                router.refresh();
              }}
            />
          </Collapse>
        </div>

        <Collapse
          title="Sarcini"
          icon={<ClipboardList className="h-4 w-4 text-muted" />}
          defaultOpen={taskRows.length > 0}
          count={taskRows.length}
          extra={
            <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
              <Plus className="h-4 w-4" /> Sarcină nouă
            </Button>
          }
        >
          <SimpleTable
            head={["Nume", "Responsabil", "Tip", "Statusul", "Prioritate", "Mesaje"]}
            rows={taskRows}
            onDelete={(row) => setDel({ entity: "task", row })}
          />
        </Collapse>

        <Collapse
          title="Mesaje"
          icon={<Mail className="h-4 w-4 text-muted" />}
          defaultOpen={noteRows.length > 0}
          count={noteRows.length}
          extra={
            <Button size="sm" variant="outline" onClick={() => setNoteOpen((v) => !v)}>
              <Plus className={`h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-strong)] ${noteOpen ? "rotate-45" : ""}`} />
              Mesaj nou
            </Button>
          }
        >
          <SimpleTable
            head={["Titlu", "Mesaj", "Data creării", "Autor", "Către", "Citit"]}
            rows={noteRows}
            onDelete={(row) => setDel({ entity: "note", row })}
          />
          <div className="collapse-grid" data-open={noteOpen}>
            <div inert={!noteOpen}>
              <div className="mt-6 space-y-3 rounded-xl border border-border bg-subtle/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Titlu" required>
                    <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
                  </Field>
                  <Field label="Către" help="Primește notificare și mesajul îi rămâne pe ecran până confirmă că l-a citit">
                    <Select value={noteRecipient} onChange={setNoteRecipient} options={options.staff} />
                  </Field>
                </div>
                <Field label="Mesaj">
                  <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNoteOpen(false)}>
                    Renunță
                  </Button>
                  <Button onClick={saveNote} loading={noteSaving}>
                    Creează
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Collapse>
      </div>

      {/* ───────── coloana de context: esențialul proiectului, fișierele ───────── */}
      <aside className="space-y-4 xl:sticky xl:top-[4.5rem]">
        <section className="rounded-xl border border-border bg-card shadow-xs">
          <h3 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <Info className="h-4 w-4 text-muted" /> Esențial
          </h3>
          <div className="space-y-3.5 p-4">
            <DetailSelect label="Tipul proiectului" value={opp.typeId} options={options.types} onChange={(v) => saveField("typeId", v)} />
            <div className="grid grid-cols-2 gap-3">
              <DateField label="Deadline" value={opp.closeDate} onSave={(v) => saveField("closeDate", v)} />
              <DateField label="Data livrării" value={opp.deliveryDate} onSave={(v) => saveField("deliveryDate", v)} />
            </div>
            <DetailInput label="Următorul pas" defaultValue={opp.nextStep} onSave={(v) => saveField("nextStep", v)} />
            <div>
              <p className="mb-1 text-xs text-muted">Descriere</p>
              <Textarea
                defaultValue={opp.description ?? ""}
                onBlur={(e) => e.target.value !== (opp.description ?? "") && saveField("description", e.target.value)}
                placeholder="Ce vrea clientul, particularități ale spațiului…"
                className="min-h-[72px] text-[13px]"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Cameră</p>
              {opp.roomId ? (
                <Link
                  href={`/admin/room/${opp.roomId}`}
                  className="text-[13px] font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {opp.roomName}
                </Link>
              ) : (
                <p className="text-[13px] font-medium">—</p>
              )}
            </div>
          </div>
        </section>

        {/* câmpurile completate rar nu mai stau în fața celor folosite zilnic */}
        <Collapse title="Mai multe detalii">
          <div className="space-y-3.5">
            <DetailSelect label="Succesiune Producție" value={opp.productionSequenceId} options={options.prodSeq} onChange={(v) => saveField("productionSequenceId", v)} />
            <DetailSelect label="Lista de proiecte (sursă)" value={opp.sourceId} options={options.sources} onChange={(v) => saveField("sourceId", v)} />
            <DetailInput label="Competitori" defaultValue={opp.competitors} onSave={(v) => saveField("competitors", v)} />
            <DetailInput label="Sinecost (lei)" defaultValue={opp.sinecost != null ? String(opp.sinecost) : ""} onSave={(v) => saveField("sinecost", v)} type="number" />
            <DateField label="Data de creare a proiectului" value={opp.startDate} onSave={(v) => saveField("startDate", v)} />
            <ReadOnly label="Creat la" value={opp.createdAt} />
          </div>
        </Collapse>

        {/* 2D + 3D + Specificații + restul = un singur loc pentru fișiere, filtrabil */}
        <Collapse
          title="Fișiere"
          icon={<Paperclip className="h-4 w-4 text-muted" />}
          defaultOpen
          count={files.length}
          extra={
            <Button
              size="sm"
              variant="outline"
              title="Încarcă un proiect 2D, 3D, specificații sau alt fișier — tipul se alege în formular"
              onClick={() => setAttachDrawer(FILE_TYPE[fileTab])}
            >
              <Plus className="h-4 w-4" /> Adaugă
            </Button>
          }
        >
          <Segmented
            className="mb-3 w-full [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:px-1.5"
            value={fileTab}
            onChange={(v) => setFileTab(v as typeof fileTab)}
            options={(["Toate", "2D", "3D", "Specificații", "Altele"] as const).map((k) => ({
              value: k,
              label: k === "Toate" ? `Toate ${files.length}` : `${k} ${files.filter((f) => f.kind === k).length}`,
            }))}
          />
          {shownFiles.length === 0 ? (
            <p className="py-3 text-center text-[13px] text-muted">
              {fileTab === "2D" || fileTab === "3D"
                ? `Niciun proiect ${fileTab} încărcat. Etapa „Contractat” îl poate cere.`
                : fileTab === "Specificații"
                  ? "Nicio specificație încărcată încă."
                  : "Niciun fișier încă."}
            </p>
          ) : (
            <ul className="-mx-1 space-y-0.5">
              {shownFiles.map((f) => (
                <li
                  key={f.id}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-subtle/70"
                >
                  <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-[10px] font-semibold text-muted">
                    {f.kind === "Altele" ? "FIȘ" : f.kind === "Specificații" ? "SPEC" : f.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{f.cells[0]?.text}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {f.cells[1]?.text} · {f.cells[2]?.text}
                    </span>
                  </span>
                  {f.downloadHref && (
                    <a
                      href={f.downloadHref}
                      title="Descarcă"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    title="Șterge fișierul"
                    onClick={() => setDel({ entity: "attachment", row: f })}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Collapse>
      </aside>

      {/* drawere */}
      {attachDrawer && (
        <FormDrawer
          config={attachForm(attachDrawer)}
          open={!!attachDrawer}
          onClose={() => setAttachDrawer(null)}
          extraValues={{
            opportunityId: String(opp.id),
            ...(opp.contactId ? { contactId: String(opp.contactId) } : {}),
          }}
        />
      )}
      <FormDrawer
        config={taskForm}
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        extraValues={{
          opportunityId: String(opp.id),
          ...(opp.contactId ? { contactId: String(opp.contactId) } : {}),
        }}
      />

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          const entity = del!.entity === "quoteRow" ? "quote" : del!.entity;
          if (entity === "quote") {
            const { deleteQuote } = await import("@/server/actions/quotes");
            const res = await deleteQuote(del!.row.id);
            if (!res.ok) toast.error(res.error ?? "Eroare");
          } else {
            const res = await deleteRecords(entity, [del!.row.id]);
            if (!res.ok) toast.error(res.error ?? "Eroare");
          }
          setDel(null);
          router.refresh();
        }}
        title="Confirmare ștergere"
        message={
          <>
            Sigur ștergi <b>{del?.row.cells[0]?.text}</b>?
          </>
        }
      />
    </div>
  );
}

function DetailSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: SelectOption[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <Select
        compact
        value={value != null ? String(value) : null}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}

function DetailInput({
  label,
  defaultValue,
  onSave,
  type = "text",
}: {
  label: string;
  defaultValue: string | null;
  onSave: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <Input
        type={type}
        defaultValue={defaultValue ?? ""}
        onBlur={(e) => e.target.value !== (defaultValue ?? "") && onSave(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-8 text-[13px]"
      />
    </div>
  );
}

/** dată cu salvare la schimbare (nu la fiecare ieșire din câmp — fără salvări și reîncărcări inutile) */
function DateField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const current = value?.slice(0, 10) ?? "";
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <Input
        type="date"
        defaultValue={current}
        onBlur={(e) => e.target.value !== current && onSave(e.target.value || null)}
        className="h-8 text-[13px]"
      />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
