// Culoarea și eticheta unei etape/unui status — decise într-un singur loc,
// ca „Contractat” să fie verde în listă, pe bord, în pagina clientului și pe dashboard.

import type { BadgeColor } from "./listTypes";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const CONTACT_STAGE: Record<string, BadgeColor> = {
  lead: "gray",
  apelat: "blue",
  masurare: "blue",
  proiectare: "blue",
  calcule: "amber",
  prezentare: "amber",
  contractat: "green",
  "predat producere": "lime",
  esuat: "red",
  concretizari: "gray",
};

const OPPORTUNITY_STAGE: Record<string, BadgeColor> = {
  "predat producere": "gray",
  "preluat producere": "blue",
  concretizari: "blue",
  "masurari finale": "blue",
  asamblare: "amber",
  livrare: "amber",
  montare: "amber",
  finisat: "green",
  garantie: "lime",
  "asistenta juridica": "red",
};

export function contactStageColor(name?: string | null): BadgeColor {
  return (name && CONTACT_STAGE[norm(name)]) || "blue";
}

export function opportunityStageColor(name?: string | null): BadgeColor {
  return (name && OPPORTUNITY_STAGE[norm(name)]) || "blue";
}

/** Punctul colorat din antetul coloanei kanban / bara de etape. */
export const stageDot: Record<BadgeColor, string> = {
  gray: "bg-foreground/35",
  blue: "bg-info",
  amber: "bg-warn",
  green: "bg-success",
  lime: "bg-lime-brand ring-1 ring-inset ring-black/15",
  red: "bg-danger",
};

// Nomenclatoarele de sarcini sunt în engleză în baza de date (todo / in progress / done,
// low / medium / high). În interfață apar mereu în română, cu aceeași culoare.
const TASK_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  todo: { label: "De făcut", color: "gray" },
  "in progress": { label: "În lucru", color: "blue" },
  done: { label: "Finalizat", color: "green" },
};
const TASK_PRIORITY: Record<string, { label: string; color: BadgeColor }> = {
  low: { label: "Scăzută", color: "gray" },
  medium: { label: "Medie", color: "amber" },
  high: { label: "Ridicată", color: "red" },
};

export function taskStatus(name?: string | null) {
  if (!name) return null;
  return TASK_STATUS[norm(name)] ?? { label: name, color: "gray" as BadgeColor };
}
export function taskPriority(name?: string | null) {
  if (!name) return null;
  return TASK_PRIORITY[norm(name)] ?? { label: name, color: "gray" as BadgeColor };
}

const CONTRACT_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Ciornă", color: "gray" },
  SEMNAT: { label: "Semnat", color: "green" },
  ANULAT: { label: "Anulat", color: "red" },
};
export function contractStatus(status?: string | null) {
  if (!status) return null;
  return CONTRACT_STATUS[status] ?? { label: status, color: "gray" as BadgeColor };
}
