// Formatare RO — sursa UNICĂ pentru cum arată datele în toată aplicația:
// date `DD/MM/YYYY HH:mm` (Europe/Chișinău), sume `57.879,00 lei` / `2.877,45 €`, gol = „—”.

const TZ = "Europe/Chisinau";

/** Valoare lipsă — același semn peste tot (nu „Nespecificat”, „-” sau gol). */
export const EMPTY = "—";

const dtf = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dtfTime = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return EMPTY;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return EMPTY;
  return dtf.format(date).replace(/\./g, "/");
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return EMPTY;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return EMPTY;
  // ro-RO: „18.09.2026, 10:30” → „18/09/2026 10:30”
  return dtfTime.format(date).replace(/\./g, "/").replace(",", "");
}

/** @deprecated secundele nu se mai afișează nicăieri — folosește `fmtDateTime`. */
export const fmtDateTimeSec = fmtDateTime;

/** „2026-09-21” în fusul Chișinău (pentru <input type="date"> și chei de zi). */
export function ymdChisinau(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const nf2 = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type Currency = "MDL" | "EUR";

/**
 * Sursa unică pentru sume: 39978.6 → „39.978,60 lei”, 1987.53 → „1.987,53 €”.
 * Mereu 2 zecimale, ca aceeași sumă să arate identic în listă, pe bord, în pagină și în PDF.
 */
export function fmtMoney(n: number | null | undefined, cur: Currency = "MDL"): string {
  if (n == null || isNaN(n)) return EMPTY;
  return `${nf2.format(n)} ${cur === "EUR" ? "€" : "lei"}`;
}

/** 57879 → „57.879,00 lei” */
export const fmtLei = (n: number | null | undefined) => fmtMoney(n, "MDL");
/** alias istoric — în interfață moneda se numește „lei” */
export const fmtMdl = fmtLei;
/** 2877.45 → „2.877,45 €” */
export const fmtEur = (n: number | null | undefined) => fmtMoney(n, "EUR");

/** „2.877,45 € (57.879,00 lei)” — sume camere/proiecte. */
export function fmtEurLei(eur: number, lei: number): string {
  return `${fmtMoney(eur, "EUR")} (${fmtMoney(lei, "MDL")})`;
}

/** Numele unei estimări: „Estimare Tehnică — 39.978,60 lei”. */
export function quoteTitle(totalMdl: number): string {
  return totalMdl > 0 ? `Estimare Tehnică — ${fmtMoney(totalMdl)}` : "Estimare la preț 0,00";
}

export function fmtNumber(n: number | null | undefined, digits = 2): string {
  if (n == null || isNaN(n)) return EMPTY;
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Diferență prietenoasă de timp: „378 zile”, „31 minute”, „2 ore” */
export function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} ${min === 1 ? "minut" : "minute"}`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "oră" : "ore"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "zi" : "zile"}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

/** Numele lunii RO, ex. „septembrie 2026” */
export function fmtMonthTitle(d: Date): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(d);
}
