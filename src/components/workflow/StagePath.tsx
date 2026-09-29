"use client";

// Parcursul unui client (vânzări) sau al unui proiect (producere): unde e acum, ce a parcurs,
// care e pasul următor — și schimbarea etapei dintr-un singur click, cu „Anulează”.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock3, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { changeContactStage, changeOpportunityStage } from "@/server/actions/stages";
import type { SelectOption } from "@/lib/listTypes";
import { cn } from "@/lib/cn";

export interface PathStage {
  id: number;
  name: string;
  /** etapă „de avarie” (Eșuat / Asistență Juridică): nu face parte din drumul normal */
  danger?: boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Ce are de făcut omul în etapa curentă, ca fișa să nu fie doar un formular. */
const CONTACT_HINTS: Record<string, string> = {
  lead: "Sună clientul și află ce își dorește.",
  apelat: "Programează măsurarea la client.",
  masurare: "Adaugă camerele măsurate și proiectele lor.",
  proiectare: "Încarcă proiectul 2D / 3D în proiectul clientului.",
  calcule: "Fă estimarea tehnică în Bordul Tehnic al proiectului.",
  prezentare: "Trimite oferta sau prezentarea și stabilește întâlnirea.",
  contractat: "Încasează avansul, apoi predă proiectul în producere.",
  "predat producere": "Proiectele contractate sunt pe Bordul Producere — urmărește-le acolo.",
};

export function StagePath({
  kind,
  entityId,
  stages,
  currentId,
  visitedIds,
  daysInStage,
  failureCauses = [],
  offBoard,
}: {
  kind: "contact" | "opportunity";
  entityId: number;
  stages: PathStage[];
  currentId: number | null;
  visitedIds: number[];
  daysInStage: number;
  failureCauses?: SelectOption[];
  /** proiect care are etapă, dar a fost scos de pe Bordul Producere */
  offBoard?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  // etapa se mută pe ecran imediat; serverul confirmă (sau o întoarce) după aceea
  const [optimisticId, setOptimisticId] = useState<number | null>(null);
  if (optimisticId !== null && optimisticId === currentId) setOptimisticId(null);
  const [failureFor, setFailureFor] = useState<number | null>(null);
  const [failureCause, setFailureCause] = useState<string | null>(null);

  const shownId = optimisticId ?? currentId;
  const currentIndex = stages.findIndex((s) => s.id === shownId);
  const current = currentIndex >= 0 ? stages[currentIndex] : null;
  const visited = new Set(visitedIds);
  const next = current && !current.danger ? stages.slice(currentIndex + 1).find((s) => !s.danger) : null;
  const hint = kind === "contact" && current ? CONTACT_HINTS[norm(current.name)] : null;

  async function move(stageId: number, cause?: number, isUndo = false) {
    if (stageId === shownId && !offBoard) return;
    const previousId = currentId;
    setOptimisticId(stageId);
    const res =
      kind === "contact"
        ? await changeContactStage(entityId, stageId, cause)
        : await changeOpportunityStage(entityId, stageId);
    if (!res.ok) {
      setOptimisticId(null);
      if ("needsFailureCause" in res && res.needsFailureCause) {
        setFailureCause(null);
        setFailureFor(stageId);
      } else toast.error(res.error ?? "Nu s-a putut schimba etapa.");
      return;
    }
    const name = stages.find((s) => s.id === stageId)?.name ?? "";
    if (isUndo || previousId == null) toast.success(`Etapa: ${name}`);
    else toast.success(`Etapa: ${name}`, () => move(previousId, undefined, true));
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-muted">
            {kind === "contact" ? "Etapa clientului" : "Etapa de producție"}
          </span>
          <span className="truncate text-sm font-semibold">{current?.name ?? "Fără etapă"}</span>
          {current && (
            <span
              title="Timp petrecut în etapa curentă"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                daysInStage > 14
                  ? "bg-danger/10 text-danger"
                  : daysInStage > 7
                    ? "bg-warn/[0.14] text-warn"
                    : "bg-foreground/[0.06] text-muted"
              )}
            >
              <Clock3 className="h-3 w-3" />
              {daysInStage === 0 ? "azi" : `${daysInStage} ${daysInStage === 1 ? "zi" : "zile"}`}
            </span>
          )}
          {offBoard && (
            <span className="rounded-full bg-warn/[0.14] px-2 py-0.5 text-[11px] font-medium text-warn">
              scos de pe bord
            </span>
          )}
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2.5">
          {hint && (
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warn" />
              <span className="truncate">{hint}</span>
            </span>
          )}
          {offBoard && current ? (
            <Button size="sm" variant="outline" onClick={() => move(current.id)}>
              Pune înapoi pe bord
            </Button>
          ) : (
            next && (
              <Button size="sm" variant="outline" onClick={() => move(next.id)} className="group">
                Treci la „{next.name}”
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </Button>
            )
          )}
        </div>
      </div>

      <ol className="-mx-1 mt-3.5 flex gap-1 overflow-x-auto px-1 pb-1">
        {stages.map((s, i) => {
          const isCurrent = s.id === shownId;
          const done = !isCurrent && (current?.danger ? visited.has(s.id) : currentIndex > i) && !s.danger;
          return (
            <li key={s.id} className="min-w-[84px] flex-1">
              <button
                type="button"
                onClick={() => move(s.id)}
                aria-current={isCurrent ? "step" : undefined}
                title={isCurrent ? "Etapa curentă" : `Mută la „${s.name}”`}
                className="group block w-full cursor-pointer rounded-md px-0.5 pb-1 pt-1.5 text-left focus-visible:outline-offset-4"
              >
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-foreground/[0.08] transition-[background-color] duration-150 group-hover:bg-foreground/[0.16]">
                  <span
                    className={cn(
                      "absolute inset-0 origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out-strong)]",
                      isCurrent
                        ? s.danger
                          ? "bg-danger"
                          : "bg-lime-brand"
                        : "bg-lime-brand/55 dark:bg-lime-brand/40",
                      isCurrent || done ? "scale-x-100" : "scale-x-0"
                    )}
                    // umplerea „curge” de la stânga la dreapta când etapa avansează
                    style={{ transitionDelay: isCurrent || done ? `${Math.min(i, 8) * 35}ms` : "0ms" }}
                  />
                </span>
                <span
                  className={cn(
                    "mt-1.5 flex items-center gap-1 text-[11px] font-medium leading-tight transition-colors duration-150",
                    isCurrent
                      ? s.danger
                        ? "text-danger"
                        : "text-foreground"
                      : done
                        ? "text-foreground/65 group-hover:text-foreground"
                        : "text-muted/75 group-hover:text-foreground"
                  )}
                >
                  {done && <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={3} />}
                  <span className="truncate">{s.name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Modal
        open={failureFor !== null}
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
                if (failureFor !== null && failureCause) move(failureFor, parseInt(failureCause, 10));
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
    </section>
  );
}
