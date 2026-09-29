"use client";

// Panourile colapsabile din pagina clientului: Camere, Proiecte, Contracte, Oferte, Mesaje + Timeline [NOU].

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DoorOpen,
  Download,
  FileSignature,
  FileText,
  FolderKanban,
  History,
  Mail,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Collapse, Empty, Badge } from "@/components/ui/Misc";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/Overlay";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveRecord, deleteRecords } from "@/server/actions/crud";
import { deleteContract, deleteOffer } from "@/server/actions/documents";
import { quickProject } from "@/server/actions/assist";
import type { SelectOption, BadgeColor } from "@/lib/listTypes";

export interface PanelCell {
  text: string;
  href?: string;
  badge?: BadgeColor;
}

export interface PanelRow {
  id: number;
  cells: PanelCell[];
  raw?: Record<string, unknown>;
  downloadHref?: string;
}

export interface TimelineItem {
  when: string;
  whenText: string;
  kind: string;
  text: string;
}

const TIMELINE_COLORS: Record<string, BadgeColor> = {
  etapă: "blue",
  mesaj: "gray",
  contract: "green",
  "predat/preluat": "amber",
  ofertă: "lime",
  atașament: "gray",
  proiect: "blue",
};

export function SimpleTable({
  head,
  rows,
  onEdit,
  onDelete,
}: {
  head: string[];
  rows: PanelRow[];
  onEdit?: (row: PanelRow) => void;
  onDelete?: (row: PanelRow) => void;
}) {
  if (rows.length === 0) return <Empty compact />;
  const hasActions = !!onEdit || !!onDelete || rows.some((r) => r.downloadHref);
  const action =
    "grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.07] hover:text-foreground";
  return (
    <div className="-mx-4 -my-4 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-subtle/60 text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
            {hasActions && <th className="w-px px-4 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border/70 transition-colors last:border-0 hover:bg-subtle/60"
            >
              {r.cells.map((c, i) => (
                <td key={i} className="max-w-[280px] truncate px-4 py-2">
                  {c.badge ? (
                    <Badge color={c.badge}>{c.text}</Badge>
                  ) : c.href ? (
                    <Link
                      href={c.href}
                      className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {c.text}
                    </Link>
                  ) : (
                    <span className={i === 0 ? "font-medium" : "text-foreground/80"}>{c.text}</span>
                  )}
                </td>
              ))}
              {hasActions && (
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    {r.downloadHref && (
                      <a href={r.downloadHref} className={action} title="Descarcă" aria-label="Descarcă">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {onEdit && (
                      <button className={action} onClick={() => onEdit(r)} title="Editează" aria-label="Editează">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className={`${action} hover:bg-danger/10 hover:text-danger`}
                        onClick={() => onDelete(r)}
                        title="Șterge"
                        aria-label="Șterge"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContactPanels({
  contactId,
  contactName,
  roomRows,
  projectRows = [],
  offerRows = [],
  contractRows,
  noteRows,
  timeline,
  roomTypes,
  staff,
  defaultRecipientId = null,
  roomTypeIds = [],
}: {
  contactId: number;
  contactName: string;
  /** destinatarul implicit al unui mesaj = responsabilul clientului */
  defaultRecipientId?: string | null;
  /** tipurile de cameră pe care clientul le are deja — prima e propusă la „Proiect nou” */
  roomTypeIds?: number[];
  projectRows?: PanelRow[];
  offerRows?: PanelRow[];
  roomRows: PanelRow[];
  contractRows: PanelRow[];
  noteRows: PanelRow[];
  timeline: TimelineItem[];
  roomTypes: SelectOption[];
  staff: SelectOption[];
  phone?: string | null;
  email?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  // Camere
  const [roomDrawer, setRoomDrawer] = useState<{ id: number | null } | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);
  const [deleteRoom, setDeleteRoom] = useState<PanelRow | null>(null);

  // Contracte
  const [deleteContractRow, setDeleteContractRow] = useState<PanelRow | null>(null);

  // Mesaje
  // Proiect nou dintr-un pas
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectRoom, setProjectRoom] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const lastName = contactName.split(/\s+/).slice(1).join(" ") || contactName;
  const suggestedName = (roomTypeId: string | null) => {
    const label = roomTypes.find((r) => r.value === roomTypeId)?.label.replace(/^Cameră\s+/i, "");
    return label && label !== "Default" ? `${label} ${lastName}` : `Proiect ${lastName}`;
  };

  async function createProject() {
    if (!projectRoom) return toast.error("Alege camera.");
    setProjectSaving(true);
    const res = await quickProject({
      contactId,
      roomTypeId: parseInt(projectRoom, 10),
      name: projectName || suggestedName(projectRoom),
    });
    setProjectSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Proiect creat — continuă cu estimarea");
    setProjectOpen(false);
    if (res.redirect) router.push(res.redirect);
  }

  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOfferRow, setDeleteOfferRow] = useState<PanelRow | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteRecipient, setNoteRecipient] = useState<string | null>(defaultRecipientId);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [deleteNote, setDeleteNote] = useState<PanelRow | null>(null);

  async function saveRoom() {
    if (!roomTypeId) {
      toast.error("Selectați camera.");
      return;
    }
    setRoomSaving(true);
    const res = await saveRecord("room", roomDrawer?.id ?? null, {
      contactId: String(contactId),
      roomTypeId,
      name: roomTypes.find((r) => r.value === roomTypeId)?.label,
    });
    setRoomSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success(roomDrawer?.id ? "Cameră actualizată" : "Cameră creată");
    setRoomDrawer(null);
    router.refresh();
  }

  async function saveNote() {
    if (!noteTitle.trim()) return toast.error("Titlul este obligatoriu.");
    setNoteSaving(true);
    const res = await saveRecord("note", null, {
      title: noteTitle,
      body: noteBody,
      recipientId: noteRecipient,
      contactId: String(contactId),
    });
    setNoteSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success(noteRecipient ? "Mesaj creat — destinatarul a fost notificat" : "Mesaj salvat");
    setNoteTitle("");
    setNoteBody("");
    setNoteRecipient(defaultRecipientId);
    setNoteOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Collapse
        title="Camere"
        icon={<DoorOpen className="h-4 w-4 text-muted" />}
        defaultOpen
        count={roomRows.length}
        extra={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRoomTypeId(null);
              setRoomDrawer({ id: null });
            }}
          >
            <Plus className="h-4 w-4" /> Adaugă Acum
          </Button>
        }
      >
        <SimpleTable
          head={["Nume cameră", "Sumă", "Data creării", "Data actualizării"]}
          rows={roomRows}
          onEdit={(r) => {
            setRoomTypeId((r.raw?.roomTypeId as string) ?? null);
            setRoomDrawer({ id: r.id });
          }}
          onDelete={(r) => setDeleteRoom(r)}
        />
      </Collapse>

      <Collapse
        title="Proiecte"
        icon={<FolderKanban className="h-4 w-4 text-muted" />}
        defaultOpen
        count={projectRows.length}
        extra={
          <Button
            size="sm"
            variant="outline"
            title="Creează camera (dacă lipsește) și proiectul dintr-un singur pas, apoi te duce direct la estimare"
            onClick={() => {
              const first = roomTypeIds[0] != null ? String(roomTypeIds[0]) : null;
              setProjectRoom(first);
              setProjectName("");
              setProjectOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Proiect nou
          </Button>
        }
      >
        {projectRows.length === 0 ? (
          <Empty compact text="Niciun proiect încă — „Proiect nou” creează camera și proiectul dintr-un pas" />
        ) : (
          <SimpleTable head={["Proiect", "Cameră", "Etapa de producție", "Valoare", "Deadline"]} rows={projectRows} />
        )}
      </Collapse>

      <Collapse
        title="Contracte"
        icon={<FileSignature className="h-4 w-4 text-muted" />}
        defaultOpen
        count={contractRows.length}
      >
        <SimpleTable
          head={["Nume", "Clienți", "Proiecte", "Sumă", "Data creării"]}
          rows={contractRows}
          onDelete={(r) => setDeleteContractRow(r)}
          onEdit={undefined}
        />
      </Collapse>

      <Collapse
        title="Oferte"
        icon={<FileText className="h-4 w-4 text-muted" />}
        defaultOpen={offerRows.length > 0}
        count={offerRows.length}
      >
        <SimpleTable
          head={["Fișier", "Cameră", "Limbă", "Data creării"]}
          rows={offerRows}
          onDelete={(r) => setDeleteOfferRow(r)}
        />
      </Collapse>

      <Collapse
        title="Mesaje"
        icon={<Mail className="h-4 w-4 text-muted" />}
        defaultOpen
        count={noteRows.length}
        extra={
          <Button size="sm" variant="outline" onClick={() => setNoteOpen((v) => !v)}>
            <Plus
              className={`h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-strong)] ${noteOpen ? "rotate-45" : ""}`}
            />
            Mesaj nou
          </Button>
        }
      >
        <SimpleTable
          head={["Titlu", "Mesaj", "Data creării", "Autor"]}
          rows={noteRows}
          onDelete={(r) => setDeleteNote(r)}
        />
        {/* formularul stă închis până e cerut — nu mai împinge istoricul în jos */}
        <div className="collapse-grid" data-open={noteOpen}>
          <div inert={!noteOpen}>
        <div className="mt-6 space-y-3 rounded-xl border border-border bg-subtle/60 p-4">
          <p className="text-sm font-semibold">Mesaj nou</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titlu" required help="Titlul scurt al notiței interne">
              <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            </Field>
            <Field
              label="Destinatarul notiței"
              help="Opțional — utilizatorul care primește notificarea"
            >
              <Select value={noteRecipient} onChange={setNoteRecipient} options={staff} />
            </Field>
          </div>
          <Field label="Client">
            <Input value={contactName} disabled />
          </Field>
          <Field label="Mesaj">
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Descrie despre client…"
            />
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

      {/* Timeline [NOU] */}
      <Collapse title="Istoric client" icon={<History className="h-4 w-4 text-muted" />}>
        {timeline.length === 0 ? (
          <Empty />
        ) : (
          <ol className="relative ml-1.5 space-y-4 border-l border-border pl-5">
            {timeline.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-lime-brand ring-4 ring-card" />
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Badge color={TIMELINE_COLORS[t.kind] ?? "gray"}>{t.kind}</Badge>
                  <span>{t.text}</span>
                  <span className="ml-auto text-xs text-muted">{t.whenText}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Collapse>

      {/* Drawer cameră */}
      <Drawer
        open={!!roomDrawer}
        onClose={() => setRoomDrawer(null)}
        title={roomDrawer?.id ? "Editează Camera Clientului" : "Creează Camera Clientului"}
        footer={
          <>
            <Button variant="outline" onClick={() => setRoomDrawer(null)}>
              Închide
            </Button>
            <Button onClick={saveRoom} loading={roomSaving}>
              {roomDrawer?.id ? "Salvează" : "Creează"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Client" required help="Camera aparține acestui client">
            <Input value={contactName} disabled />
          </Field>
          <Field label="Nume cameră" required>
            <Select
              value={roomTypeId}
              onChange={setRoomTypeId}
              options={roomTypes}
              placeholder="Selectează camera"
            />
          </Field>
        </div>
      </Drawer>

      {/* Proiect nou — un singur pas */}
      <Modal
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        title="Proiect nou"
        width={440}
        footer={
          <>
            <Button variant="outline" onClick={() => setProjectOpen(false)}>
              Închide
            </Button>
            <Button onClick={createProject} loading={projectSaving}>
              Creează și fă estimarea
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cameră" required help="Dacă clientul nu are încă această cameră, o creez eu">
            <Select
              value={projectRoom}
              onChange={setProjectRoom}
              options={roomTypes}
              placeholder="Selectează camera"
              allowClear={false}
            />
          </Field>
          <Field label="Numele proiectului" help="Lasă gol și îl numesc eu după cameră și client">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={suggestedName(projectRoom)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
          </Field>
          <p className="text-xs text-muted">
            Responsabilul și data de start se completează singure. După creare ajungi direct în Bordul Tehnic al
            proiectului.
          </p>
        </div>
      </Modal>

      {/* Confirmări */}
      <ConfirmDialog
        open={!!deleteRoom}
        onClose={() => setDeleteRoom(null)}
        onConfirm={async () => {
          const res = await deleteRecords("room", [deleteRoom!.id]);
          setDeleteRoom(null);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Cameră ștearsă");
            router.refresh();
          }
        }}
        title="Șterge camera"
        message={
          <>
            Sigur ștergi camera <b>{deleteRoom?.cells[0]?.text}</b>? O cameră care are proiecte nu
            poate fi ștearsă — mută sau șterge întâi proiectele.
          </>
        }
      />
      <ConfirmDialog
        open={!!deleteContractRow}
        onClose={() => setDeleteContractRow(null)}
        onConfirm={async () => {
          const res = await deleteContract(deleteContractRow!.id);
          setDeleteContractRow(null);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Contract șters");
            router.refresh();
          }
        }}
        title="Șterge contractul"
        message={
          <>
            Sigur ștergi contractul <b>{deleteContractRow?.cells[0]?.text}</b>?
          </>
        }
      />
      <ConfirmDialog
        open={!!deleteOfferRow}
        onClose={() => setDeleteOfferRow(null)}
        onConfirm={async () => {
          const res = await deleteOffer(deleteOfferRow!.id);
          setDeleteOfferRow(null);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Ofertă ștearsă");
            router.refresh();
          }
        }}
        title="Șterge oferta"
        message={
          <>
            Sigur ștergi oferta <b>{deleteOfferRow?.cells[0]?.text}</b>?
          </>
        }
      />
      <ConfirmDialog
        open={!!deleteNote}
        onClose={() => setDeleteNote(null)}
        onConfirm={async () => {
          const res = await deleteRecords("note", [deleteNote!.id]);
          setDeleteNote(null);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Mesaj șters");
            router.refresh();
          }
        }}
        title="Șterge mesajul"
        message={
          <>
            Sigur ștergi mesajul <b>{deleteNote?.cells[0]?.text}</b>?
          </>
        }
      />
    </div>
  );
}
