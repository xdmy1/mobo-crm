"use client";

// Kanban generic (Bord Vânzări / Bord Producere) cu drag & drop nativ,
// căutare, colapsare coloane și indicator „zile în etapă” [NOU].
// Mutarea e optimistă: cardul ajunge în coloana nouă pe loc, serverul confirmă după (sau îl întoarce).

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronsLeft,
  ChevronsRight,
  MonitorPlay,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { MultiSelect, Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Overlay";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Misc";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";
import { fmtLei } from "@/lib/format";
import { stageDot } from "@/lib/status";
import {
  changeContactStage,
  changeOpportunityStage,
  removeOpportunityFromBoard,
} from "@/server/actions/stages";
import { deleteRecords, saveRecord } from "@/server/actions/crud";
import type { BadgeColor, SelectOption } from "@/lib/listTypes";

export interface KanbanCard {
  id: number;
  columnId: number;
  title: string;
  /** ID-ul clientului, afișat separat de nume (la fel ca în liste și în fișă) */
  humanId?: string;
  /** valoarea numerică a cardului, pentru totalul coloanei */
  amount?: number;
  datetime: string;
  phone?: string;
  sum?: string;
  projectName?: string;
  deliveryText?: string;
  href: string;
  staffName?: string;
  daysInStage: number;
}

export interface KanbanColumn {
  id: number;
  name: string;
  danger?: boolean;
  /** aceeași culoare de etapă ca în liste și în bara de parcurs */
  color?: BadgeColor;
}

export function KanbanBoard({
  board,
  columns,
  cards,
  failureCauses = [],
  staffOptions = [],
  leadStageId,
}: {
  board: "sales" | "production";
  columns: KanbanColumn[];
  cards: KanbanCard[];
  failureCauses?: SelectOption[];
  staffOptions?: SelectOption[];
  leadStageId?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [visible, setVisible] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const [failureFor, setFailureFor] = useState<{ cardId: number; stageId: number } | null>(null);
  const [failureCause, setFailureCause] = useState<string | null>(null);
  const [removeCard, setRemoveCard] = useState<KanbanCard | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [tv, setTv] = useState(false);
  const [clock, setClock] = useState("");
  // mutări încă neconfirmate de server: cardId → coloana nouă
  const [moves, setMoves] = useState<Record<number, number>>({});
  const [landed, setLanded] = useState<number | null>(null);

  // Mod TV [NOU]: ecran mare pentru atelier — auto-refresh la 30s + ceas live
  useEffect(() => {
    if (!tv) return;
    const refresh = setInterval(() => startTransition(() => router.refresh()), 30000);
    const tick = setInterval(
      () =>
        setClock(
          new Intl.DateTimeFormat("ro-RO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Europe/Chisinau",
          }).format(new Date())
        ),
      1000
    );
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setTv(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv]);

  const shownColumns = useMemo(
    () =>
      visible.length
        ? columns.filter((c) => visible.includes(String(c.id)))
        : columns,
    [columns, visible]
  );

  const filteredCards = useMemo(() => {
    const placed = cards.map((c) => (moves[c.id] != null ? { ...c, columnId: moves[c.id], daysInStage: 0 } : c));
    if (!search.trim()) return placed;
    const t = search.toLowerCase();
    return placed.filter(
      (c) =>
        c.title.toLowerCase().includes(t) ||
        c.humanId?.toLowerCase().includes(t) ||
        c.phone?.toLowerCase().includes(t) ||
        c.projectName?.toLowerCase().includes(t)
    );
  }, [cards, search, moves]);

  const clearMove = (cardId: number) =>
    setMoves((m) => {
      const next = { ...m };
      delete next[cardId];
      return next;
    });

  async function moveTo(cardId: number, stageId: number, cause?: number) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === stageId) return;
    setMoves((m) => ({ ...m, [cardId]: stageId }));
    setLanded(cardId);
    const res =
      board === "sales"
        ? await changeContactStage(cardId, stageId, cause)
        : await changeOpportunityStage(cardId, stageId);
    if (!res.ok) {
      clearMove(cardId); // cardul se întoarce de unde a plecat
      if ("needsFailureCause" in res && res.needsFailureCause) {
        setFailureFor({ cardId, stageId });
        setFailureCause(null);
      } else {
        toast.error(res.error ?? "Nu s-a putut schimba etapa.");
      }
      return;
    }
    startTransition(() => {
      router.refresh();
      clearMove(cardId);
    });
  }

  async function confirmRemove() {
    if (!removeCard) return;
    const res =
      board === "sales"
        ? await deleteRecords("contact", [removeCard.id])
        : await removeOpportunityFromBoard(removeCard.id);
    setRemoveCard(null);
    if (!res.ok) toast.error(res.error ?? "Eroare");
    else {
      toast.success(board === "sales" ? "Client scos din bord" : "Proiect scos din bord");
      router.refresh();
    }
  }

  return (
    <div
      className={
        tv
          ? "fixed inset-0 z-[95] flex flex-col gap-3 overflow-hidden bg-background p-5"
          : "space-y-5"
      }
    >
      {tv ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomobo.png" alt="Mobo" className="h-9 w-auto rounded-lg bg-ink p-1.5" />
          <h1 className="text-xl font-semibold tracking-tight">
            {board === "sales" ? "Bord Vânzări" : "Bord Producere"}
          </h1>
          <span className="rounded-full bg-lime-brand/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Mod TV · actualizare la 30s
          </span>
          <span className="ml-auto font-mono text-2xl font-semibold tabular-nums">{clock}</span>
          <Button variant="outline" size="sm" onClick={() => setTv(false)}>
            <X className="h-4 w-4" /> Ieși (Esc)
          </Button>
        </div>
      ) : (
        <PageHeader
          title={board === "sales" ? "Bord Vânzări" : "Bord Producere"}
          subtitle={`${filteredCards.length} ${board === "sales" ? "clienți" : "proiecte"} în ${shownColumns.length} etape · trage cardurile între coloane`}
          actions={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Caută în bord…"
                  className="w-56 pl-8"
                />
              </div>
              <MultiSelect
                className="w-64"
                values={visible}
                onChange={setVisible}
                options={columns.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder={board === "sales" ? "Selectați etapele" : "Filtrează etapele"}
              />
              <Button
                variant="outline"
                onClick={() => setTv(true)}
                title="Ecran mare pentru atelier / showroom — se actualizează singur"
              >
                <MonitorPlay className="h-4 w-4" /> Mod TV
              </Button>
            </>
          }
        />
      )}

      <div
        className={cn(
          "flex items-stretch gap-3 overflow-x-auto pb-3",
          tv && "min-h-0 flex-1 overflow-y-auto"
        )}
      >
        {shownColumns.map((col) => {
          const colCards = filteredCards.filter((c) => c.columnId === col.id);
          const colTotal = colCards.reduce((s, c) => s + (c.amount ?? 0), 0);
          const isCollapsed = collapsed.has(col.id);
          if (isCollapsed) {
            return (
              <div
                key={col.id}
                className="flex w-11 shrink-0 cursor-pointer flex-col items-center gap-2.5 rounded-xl bg-foreground/[0.04] py-3 transition-colors hover:bg-foreground/[0.07]"
                onClick={() =>
                  setCollapsed((s) => {
                    const n = new Set(s);
                    n.delete(col.id);
                    return n;
                  })
                }
              >
                <ChevronsRight className="h-4 w-4 text-muted" />
                <span className="rounded-full bg-card px-1.5 text-xs font-semibold tabular-nums shadow-xs">
                  {colCards.length}
                </span>
                <span className="text-xs font-medium text-muted [writing-mode:vertical-rl]">
                  {col.name}
                </span>
              </div>
            );
          }
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((v) => (v === col.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                if (dragId != null) moveTo(dragId, col.id);
                setDragId(null);
              }}
              className={cn(
                "flex min-h-[calc(100vh-13.5rem)] w-[288px] shrink-0 flex-col rounded-xl bg-foreground/[0.035] ring-1 ring-inset ring-transparent transition-[background-color,box-shadow] duration-150",
                overCol === col.id && "bg-lime-brand/[0.12] ring-lime-brand"
              )}
            >
              <div className="flex items-center gap-2 px-3 pb-1 pt-3">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    col.danger ? "bg-danger" : stageDot[col.color ?? "lime"]
                  )}
                />
                <span className="truncate text-[13px] font-semibold">{col.name}</span>
                <span className="rounded-full bg-card px-1.5 text-xs font-medium tabular-nums text-muted shadow-xs">
                  {colCards.length}
                </span>
                {colTotal > 0 && (
                  <span className="truncate text-[11px] font-medium tabular-nums text-muted" title="Valoarea proiectelor din etapă">
                    {fmtLei(colTotal)}
                  </span>
                )}
                <button
                  className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted/70 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
                  title="Colapsează coloana"
                  onClick={() =>
                    setCollapsed((s) => new Set(s).add(col.id))
                  }
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex min-h-[96px] flex-1 flex-col gap-2 p-2">
                {board === "sales" && leadStageId === col.id && (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-[13px] font-medium text-muted transition-colors hover:border-foreground/40 hover:bg-card hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Adaugă Client Nou
                  </button>
                )}
                {colCards.length === 0 && !(board === "sales" && leadStageId === col.id) && (
                  <p className="py-6 text-center text-xs text-muted/70">Nicio înregistrare</p>
                )}
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group relative cursor-grab rounded-lg border border-border bg-card shadow-xs transition-[border-color,box-shadow,opacity,transform] duration-150 hover:border-border-strong hover:shadow-sm active:cursor-grabbing",
                      dragId === card.id && "scale-[0.98] opacity-40",
                      landed === card.id && "animate-pop-in"
                    )}
                    onAnimationEnd={() => landed === card.id && setLanded(null)}
                  >
                    <button
                      onClick={() => setRemoveCard(card)}
                      className="absolute right-1.5 top-1.5 z-10 hidden h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger group-hover:grid"
                      title={board === "sales" ? "Șterge clientul" : "Scoate din bord"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <Link href={card.href} className="block px-3 py-2.5">
                      <p className="pr-5 text-[13px] font-medium leading-snug">
                        {card.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        {card.humanId && <span className="font-mono text-[11px]">{card.humanId}</span>}
                        {card.humanId && <span aria-hidden>·</span>}
                        <span>{card.datetime}</span>
                      </p>
                      {card.phone && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground/80">
                          <Phone className="h-3 w-3 text-muted" /> {card.phone}
                        </p>
                      )}
                      {card.sum && (
                        <p className="mt-1.5 text-[13px] font-semibold tabular-nums">{card.sum}</p>
                      )}
                      {card.projectName && (
                        <p className="mt-0.5 text-xs text-foreground/80">
                          Proiect: {card.projectName}
                        </p>
                      )}
                      {card.deliveryText && (
                        <p className="mt-0.5 text-xs text-muted">{card.deliveryText}</p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between border-t border-border/70 pt-2">
                        {card.staffName ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted">
                            <Avatar name={card.staffName} size={18} />
                            <span className="max-w-[110px] truncate">{card.staffName}</span>
                          </span>
                        ) : (
                          <span />
                        )}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            card.daysInStage > 14
                              ? "bg-danger/10 text-danger"
                              : card.daysInStage > 7
                                ? "bg-warn/[0.14] text-warn"
                                : "bg-foreground/[0.06] text-muted"
                          )}
                          title="Zile în etapa curentă"
                        >
                          {card.daysInStage} z
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal cauza eșecului */}
      <Modal
        open={!!failureFor}
        onClose={() => setFailureFor(null)}
        title="Cauza eșecului"
        width={420}
        footer={
          <>
            <Button variant="outline" onClick={() => setFailureFor(null)}>
              Anulează
            </Button>
            <Button
              disabled={!failureCause}
              onClick={() => {
                if (failureFor && failureCause)
                  moveTo(failureFor.cardId, failureFor.stageId, parseInt(failureCause, 10));
                setFailureFor(null);
              }}
            >
              Confirmă
            </Button>
          </>
        }
      >
        <Field label="Selectează cauza eșecului" required>
          <Select
            value={failureCause}
            onChange={setFailureCause}
            options={failureCauses}
            placeholder="Cauza eșecului…"
          />
        </Field>
      </Modal>

      {/* Confirmare scoatere */}
      <ConfirmDialog
        open={!!removeCard}
        onClose={() => setRemoveCard(null)}
        onConfirm={confirmRemove}
        title={board === "sales" ? "Șterge clientul" : "Scoate proiectul din bord"}
        message={
          <>
            Sigur {board === "sales" ? "ștergi clientul" : "scoți proiectul"}{" "}
            <b>{removeCard?.title}</b>?
          </>
        }
        confirmLabel={board === "sales" ? "Șterge" : "Scoate"}
      />

      {/* Adaugă client nou (doar bord vânzări) */}
      {board === "sales" && (
        <AddClientModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          staffOptions={staffOptions}
          stageOptions={columns.map((c) => ({ value: String(c.id), label: c.name }))}
          leadStageId={leadStageId}
        />
      )}
    </div>
  );
}

function AddClientModal({
  open,
  onClose,
  staffOptions,
  stageOptions,
  leadStageId,
}: {
  open: boolean;
  onClose: () => void;
  staffOptions: SelectOption[];
  stageOptions: SelectOption[];
  leadStageId?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(
    leadStageId ? String(leadStageId) : null
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Prenumele și numele sunt obligatorii.");
      return;
    }
    setLoading(true);
    const res = await saveRecord("contact", null, {
      firstName,
      lastName,
      phone,
      staffId,
      stageId: stageId ?? (leadStageId ? String(leadStageId) : null),
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error ?? "Eroare");
      return;
    }
    toast.success("Client creat");
    setFirstName("");
    setLastName("");
    setPhone("");
    setErr(null);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adaugă Client Nou"
      width={440}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Închide
          </Button>
          <Button onClick={submit} loading={loading}>
            Creează
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Prenume" required>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ion" />
        </Field>
        <Field label="Nume" required>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Popescu" />
        </Field>
        <Field label="Număr de contact">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+373 69 000 000" />
        </Field>
        <Field label="Responsabilul contactului">
          <Select value={staffId} onChange={setStaffId} options={staffOptions} />
        </Field>
        <Field label="Etapa">
          <Select value={stageId} onChange={setStageId} options={stageOptions} />
        </Field>
        {err && <p className="text-[13px] font-medium text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
