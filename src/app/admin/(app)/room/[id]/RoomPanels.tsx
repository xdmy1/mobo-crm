"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Collapse } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { FormDrawer } from "@/components/form/FormDrawer";
import { deleteRecords } from "@/server/actions/crud";
import { SimpleTable, type PanelRow } from "../../contact/[id]/ContactPanels";
import { ymdChisinau } from "@/lib/format";
import type { FormConfig, SelectOption } from "@/lib/listTypes";

export function RoomPanels({
  roomId,
  contactId,
  roomName,
  contactLastName,
  attachmentRows,
  projectRows,
  staff,
  defaults,
}: {
  roomId: number;
  contactId: number;
  roomName: string;
  contactLastName: string;
  attachmentRows: PanelRow[];
  projectRows: PanelRow[];
  staff: SelectOption[];
  roomTypes: SelectOption[];
  /** precompletări: utilizatorul curent și responsabilul clientului */
  defaults: { currentUserId: string; contactStaffId: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [del, setDel] = useState<{ entity: string; row: PanelRow } | null>(null);

  const attachForm: FormConfig = {
    title: "Creează Atașament",
    entity: "attachment",
    fields: [
      {
        name: "files",
        label: "Atașare",
        type: "file",
        required: true,
        help: "Poți încărca mai multe fișiere odată",
      },
      {
        name: "reportToId",
        label: "Raportează managerului",
        type: "select",
        required: true,
        options: staff,
        defaultValue: defaults.contactStaffId ?? defaults.currentUserId,
        help: "Persoana care primește notificarea",
      },
      {
        name: "type",
        label: "Tipul atașamentului",
        type: "select",
        required: true,
        defaultValue: "ATASAMENT",
        options: [
          { value: "ATASAMENT", label: "Atașament" },
          { value: "PROIECT2D", label: "Proiect2D" },
          { value: "PROIECT3D", label: "Proiect3D" },
          { value: "MASURARI", label: "Măsurări" },
        ],
      },
      { name: "name", label: "Nume (opțional)", type: "text" },
    ],
  };

  const projectForm: FormConfig = {
    title: "Creează Proiect",
    entity: "opportunity",
    // numele, responsabilul și data de start vin completate — omul schimbă doar dacă vrea altceva
    fields: [
      {
        name: "name",
        label: "Nume",
        type: "text",
        required: true,
        defaultValue: `${roomName.replace(/^Cameră\s+/i, "")} ${contactLastName}`.trim(),
        help: "Denumirea proiectului",
      },
      {
        name: "staffId",
        label: "Responsabil de proiect",
        type: "select",
        options: staff,
        defaultValue: defaults.contactStaffId ?? defaults.currentUserId,
      },
      { name: "startDate", label: "Data de creare a proiectului", type: "date", defaultValue: ymdChisinau() },
      { name: "closeDate", label: "Deadline", type: "date" },
      { name: "description", label: "Descriere", type: "textarea", placeholder: "Ce vrea clientul în această cameră…" },
    ],
  };

  return (
    <div className="space-y-4">
      <Collapse
        title="Proiecte"
        icon={<FolderKanban className="h-4 w-4 text-muted" />}
        defaultOpen
        count={projectRows.length}
        extra={
          <Button
            size="sm"
            variant={projectRows.length === 0 ? "create" : "outline"}
            onClick={() => setProjectOpen(true)}
            title="Creează un proiect în această cameră; după salvare ajungi direct în calculator"
          >
            <Plus className="h-4 w-4" /> Proiect nou
          </Button>
        }
      >
        {projectRows.length === 0 ? (
          <p className="py-2 text-[13px] text-muted">
            Camera nu are încă niciun proiect. „Proiect nou” îl creează cu numele și responsabilul gata completate.
          </p>
        ) : (
          <SimpleTable
            head={["Proiect", "Valoare", "Etapa de producție", "Tip", "Data creării"]}
            rows={projectRows}
            onDelete={(row) => setDel({ entity: "opportunity", row })}
          />
        )}
      </Collapse>

      <Collapse
        title="Fișiere"
        icon={<Paperclip className="h-4 w-4 text-muted" />}
        defaultOpen={attachmentRows.length > 0}
        count={attachmentRows.length}
        extra={
          <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)} title="Măsurări, poze, schițe — orice fișier legat de această cameră">
            <Plus className="h-4 w-4" /> Adaugă fișier
          </Button>
        }
      >
        <SimpleTable
          head={["Nume", "Responsabil", "Data creării"]}
          rows={attachmentRows}
          onDelete={(row) => setDel({ entity: "attachment", row })}
        />
      </Collapse>

      <FormDrawer
        config={attachForm}
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        extraValues={{ roomId: String(roomId), contactId: String(contactId) }}
      />
      <FormDrawer
        config={projectForm}
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        extraValues={{ roomId: String(roomId), contactId: String(contactId) }}
        onSaved={(res) => res.id && router.push(`/admin/opportunity/${res.id}?wizard=1`)}
      />

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          const res = await deleteRecords(del!.entity, [del!.row.id]);
          setDel(null);
          if (!res.ok) toast.error(res.error ?? "Eroare");
          else {
            toast.success("Element șters");
            router.refresh();
          }
        }}
        title="Confirmare ștergere"
        message={
          <>
            Sigur ștergi <b>{del?.row.cells[0]?.text}</b> din camera „{roomName}”?
          </>
        }
      />
    </div>
  );
}
