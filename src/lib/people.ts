// Cum se scrie un om în aplicație — o singură formă, peste tot.

import { EMPTY } from "./format";

type Named = { firstName?: string | null; lastName?: string | null };

/** „Ion Rusu” (Prenume Nume). */
export function personName(p?: Named | null): string {
  if (!p) return EMPTY;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || EMPTY;
}

/** „Ion Rusu · #4” — client + ID-ul lui, în liste de selecție și pe carduri. */
export function contactLabel(c?: (Named & { humanId?: number | null }) | null): string {
  if (!c) return EMPTY;
  return c.humanId != null ? `${personName(c)} · #${c.humanId}` : personName(c);
}
