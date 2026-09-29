// „Scena” unei prezentări: fiecare slide e o listă de forme simple, în inch, pe o pânză 16:9.
// Același slide e randat apoi identic în PPTX (renderPptx) și în PDF (renderPdf) —
// de aceea șablonul se schimbă într-un singur loc (deck.ts), iar cele două formate nu pot diverge.

export const SW = 13.333; // lățimea slide-ului (inch) — 16:9 „widescreen”
export const SH = 7.5;

export type Weight = "light" | "regular" | "medium" | "semibold" | "bold";

export interface TextRun {
  text: string;
  color?: string;
  weight?: Weight;
  /** trece pe rând nou DUPĂ acest fragment */
  br?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Ordinea de intrare în animația slide-ului (1 = primul). Elementele cu același număr intră
   * împreună; cele fără `anim` sunt acolo de la început. PDF-ul ignoră câmpul.
   */
  anim?: number;
  /** cum intră: `rise` = urcă ușor + apare (implicit), `fade` = doar apare, `wipe` = se desfășoară din stânga */
  fx?: "rise" | "fade" | "wipe";
}

export type Scrim = "left" | "bottom" | "full" | "leftStrong" | "cover" | "caption";

export type Node =
  | (Box & {
      t: "rect";
      fill?: string;
      /** 0–1 */
      opacity?: number;
      radius?: number;
      stroke?: string;
      strokeW?: number;
    })
  | (Box & { t: "ellipse"; fill?: string; stroke?: string; strokeW?: number })
  | (Box & { t: "line"; color: string; width?: number })
  | (Box & {
      t: "text";
      text: string | TextRun[];
      size: number;
      color: string;
      weight?: Weight;
      align?: "left" | "center" | "right";
      valign?: "top" | "middle" | "bottom";
      /** spațiere între litere, în puncte */
      tracking?: number;
      /** înălțimea rândului ca multiplu al mărimii fontului */
      lh?: number;
    })
  | (Box & {
      t: "image";
      /** cale pe disc; alternativ `svg` (pictogramă vectorială) sau `data` (PNG gata făcut, ex. cod QR) */
      src?: string;
      svg?: string;
      data?: Buffer;
      /** raza colțurilor (inch); colțurile se umplu cu `bg`, deci trebuie să fie culoarea slide-ului */
      radius?: number;
      bg?: string;
      scrim?: Scrim;
      fit?: "cover" | "contain";
    });

export interface Slide {
  bg: string;
  nodes: Node[];
  /** tranziția CU CARE INTRĂ slide-ul */
  transition?: "fade" | "push" | "cover";
}

export interface Deck {
  title: string;
  author: string;
  slides: Slide[];
}
