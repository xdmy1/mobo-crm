// Imaginile din calculator pentru sertare, mecanisme și organizatoare.
//
// Fotografiile sunt de pe montajele MOBO (aceleași ca pe mobo.md, trimise de client pentru pașii
// Sertare / Mecanisme). Unde nu există fotografie, o schiță arată CUM se mișcă frontul — ce
// deosebește de fapt un Aventos HS de un HL. O fotografie nouă se adaugă în /public/wizard și aici.

import type { ReactNode } from "react";

export interface OptionPhoto {
  src: string;
  /** object-position — subiectul nu e mereu în centrul cadrului */
  pos?: string;
}

export const DRAWER_PHOTOS: Record<string, OptionPhoto> = {
  "blum-metal": { src: "/wizard/blum-metal.jpg", pos: "50% 62%" },
  "blum-lemn": { src: "/wizard/blum-lemn.jpg", pos: "50% 80%" },
  "hettich-metal": { src: "/wizard/hettich-metal.jpg", pos: "50% 62%" },
  "hettich-lemn": { src: "/wizard/hettich-lemn.jpg", pos: "50% 52%" },
};

export const DRAWER_LABELS: Record<string, string> = {
  "blum-metal": "Blum — laterale metalice",
  "blum-lemn": "Blum — laterale din lemn",
  "hettich-metal": "Hettich — laterale metalice",
  "hettich-lemn": "Hettich — laterale din lemn",
};

export const MECHANISM_PHOTOS: Record<string, OptionPhoto> = {
  aventos_hk_xs: { src: "/wizard/aventos-hk-xs.jpg", pos: "50% 45%" },
  aventos_hf: { src: "/wizard/aventos-hf.jpg", pos: "50% 30%" },
  colt_450: { src: "/wizard/colt-kessebohmer.jpg", pos: "50% 62%" },
  colt_600: { src: "/wizard/colt-kessebohmer.jpg", pos: "50% 62%" },
};

/* ───────────────────────────── schițe ───────────────────────────── */

// corp de sus văzut din lateral: frontul închis e linia punctată, cel deschis e lime
const wallCabinet = (
  <>
    <rect x="34" y="42" width="38" height="36" rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
    <line x1="34" y1="60" x2="72" y2="60" className="stroke-current opacity-30" strokeWidth="1" />
    <line x1="75" y1="42" x2="75" y2="78" className="stroke-current opacity-40" strokeWidth="1.4" strokeDasharray="2.5 3" />
  </>
);

const front = (points: string) => (
  <polygon points={points} className="fill-lime-brand/70 stroke-current" strokeWidth="1.4" strokeLinejoin="round" />
);

const arrow = (d: string) => (
  <path d={d} className="stroke-current opacity-55" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#mobo-arrow)" />
);

// dulap văzut din față (Hettich — uși glisante / pliante)
const wardrobe = (
  <>
    <rect x="24" y="10" width="72" height="70" rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
    <line x1="24" y1="15" x2="96" y2="15" className="stroke-current opacity-40" strokeWidth="1.2" />
  </>
);

// corp de jos din lateral, cu frontul tras în afară (Kessebohmer / organizatoare)
const baseCabinet = (y: number, h: number) => (
  <rect x="22" y={y} width="40" height={h} rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
);

const PICTOGRAMS: Record<string, ReactNode> = {
  // ridicare „sus și peste”: frontul ajunge deasupra corpului, înclinat spre spate
  aventos_hs: (
    <>
      {wallCabinet}
      {front("40,30 78,20 79,23.5 41,33.5")}
      {arrow("M82 74 C 96 58, 96 34, 84 24")}
    </>
  ),
  // ridicare paralelă: frontul urcă drept, rămâne vertical
  aventos_hl: (
    <>
      {wallCabinet}
      {front("73.5,6 77,6 77,40 73.5,40")}
      {arrow("M88 70 L 88 18")}
    </>
  ),
  // rabatare: frontul se rotește în balamaua de sus
  aventos_hk: (
    <>
      {wallCabinet}
      {front("73,42 99,18 101.5,20.5 75.5,44.5")}
      {arrow("M80 76 C 100 66, 108 44, 103 30")}
    </>
  ),
  // rabatare cu piston: aceeași mișcare, cu pistonul vizibil
  piston_gaz: (
    <>
      {wallCabinet}
      {front("73,42 99,18 101.5,20.5 75.5,44.5")}
      <line x1="44" y1="70" x2="64" y2="56" className="stroke-current" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="62" y1="57.5" x2="86" y2="31" className="stroke-current" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  // uși glisante pe șină sus: două foi care se suprapun
  top_line: (
    <>
      {wardrobe}
      <rect x="27" y="17" width="36" height="60" className="fill-card stroke-current" strokeWidth="1.3" />
      <rect x="55" y="18.5" width="38" height="58.5" className="fill-lime-brand/70 stroke-current" strokeWidth="1.3" />
      {arrow("M66 86 L 46 86")}
      {arrow("M76 86 L 96 86")}
    </>
  ),
  // uși pliante: văzute de sus, foile se strâng în armonică
  wing_line: (
    <>
      <rect x="18" y="20" width="84" height="30" rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
      <polyline points="20,50 31,70 42,50" className="fill-none stroke-current" strokeWidth="2.2" strokeLinejoin="round" />
      <polyline points="100,50 89,70 78,50" className="stroke-lime-brand fill-none" strokeWidth="3.4" strokeLinejoin="round" />
      <polyline points="100,50 89,70 78,50" className="fill-none stroke-current" strokeWidth="1" strokeLinejoin="round" />
      <line x1="42" y1="50" x2="78" y2="50" className="stroke-current opacity-40" strokeWidth="1.4" strokeDasharray="2.5 3" />
      {arrow("M72 80 L 92 80")}
    </>
  ),
  // glisare simplă: o ușă care alunecă pe șina de jos
  glisare: (
    <>
      {wardrobe}
      <line x1="24" y1="76" x2="96" y2="76" className="stroke-current opacity-40" strokeWidth="1.2" />
      <rect x="27" y="17" width="44" height="58" className="fill-lime-brand/70 stroke-current" strokeWidth="1.3" />
      {arrow("M42 46 L 62 46")}
    </>
  ),
  // sub chiuvetă: sertar cu coșuri, sifonul rămâne în spate
  cleaning_agent: (
    <>
      {baseCabinet(34, 46)}
      <path d="M30 40 v8 a4 4 0 0 0 8 0 v-3" className="fill-none stroke-current opacity-50" strokeWidth="1.4" />
      <rect x="46" y="54" width="52" height="24" rx="1.5" className="fill-lime-brand/30 stroke-current" strokeWidth="1.4" />
      <path d="M52 58 h14 l-1.5 17 h-11 z" className="fill-card stroke-current" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M72 58 h20 l-1.5 17 h-17 z" className="fill-card stroke-current" strokeWidth="1.2" strokeLinejoin="round" />
      {arrow("M66 46 L 92 46")}
    </>
  ),
  // lângă plită: coloană îngustă extractibilă cu sticle
  cooking_agent: (
    <>
      {baseCabinet(30, 50)}
      <rect x="44" y="34" width="56" height="44" rx="1.5" className="fill-lime-brand/30 stroke-current" strokeWidth="1.4" />
      <line x1="44" y1="56" x2="100" y2="56" className="stroke-current" strokeWidth="1.3" />
      {[52, 62, 72, 84].map((x) => (
        <path key={`t${x}`} d={`M${x} 55 v-11 q0 -3 2 -4 v-3 h2 v3 q2 1 2 4 v11 z`} className="fill-card stroke-current" strokeWidth="1" />
      ))}
      {[54, 68, 82].map((x) => (
        <rect key={`b${x}`} x={x} y="64" width="9" height="13" rx="1" className="fill-card stroke-current" strokeWidth="1" />
      ))}
      {arrow("M64 24 L 90 24")}
    </>
  ),
  // cămară: coloană înaltă trasă cu totul afară, cu rafturi
  dispensa: (
    <>
      <rect x="20" y="6" width="38" height="80" rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
      <rect x="44" y="8" width="56" height="76" rx="1.5" className="fill-lime-brand/30 stroke-current" strokeWidth="1.4" />
      {[22, 38, 54, 70].map((y) => (
        <line key={y} x1="44" y1={y} x2="100" y2={y} className="stroke-current" strokeWidth="1.2" />
      ))}
      {[[50, 14], [62, 30], [80, 46], [54, 62], [86, 14], [72, 76]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="9" height="7.5" rx="1" className="fill-card stroke-current" strokeWidth="1" />
      ))}
      {arrow("M66 92 L 94 92")}
    </>
  ),
  // pantofar extractibil: rafturi înclinate
  incaltaminte: (
    <>
      <rect x="20" y="8" width="40" height="76" rx="1.5" className="fill-card stroke-current" strokeWidth="1.6" />
      <rect x="40" y="10" width="60" height="72" rx="1.5" className="fill-lime-brand/30 stroke-current" strokeWidth="1.4" />
      {[26, 44, 62, 80].map((y) => (
        <g key={y}>
          <line x1="44" y1={y} x2="96" y2={y - 8} className="stroke-current" strokeWidth="1.3" />
          <path d={`M56 ${y - 2.5} q2 -6 9 -5 l8 -1 q4 0 4 3 z`} className="fill-card stroke-current" strokeWidth="1" strokeLinejoin="round" />
        </g>
      ))}
      {arrow("M66 92 L 94 92")}
    </>
  ),
  // suport de pantaloni: bare pe care atârnă pantalonii
  pantaloni: (
    <>
      <rect x="16" y="14" width="88" height="10" rx="1.5" className="fill-lime-brand/50 stroke-current" strokeWidth="1.4" />
      {[30, 46, 62, 78, 94].map((x) => (
        <g key={x}>
          <line x1={x} y1="24" x2={x} y2="32" className="stroke-current" strokeWidth="1.3" />
          <path d={`M${x - 6} 32 h12 l1.5 46 h-5.5 l-2 -38 l-2 38 h-5.5 z`} className="fill-card stroke-current" strokeWidth="1" strokeLinejoin="round" />
        </g>
      ))}
    </>
  ),
};

/** Cheia schiței pentru un organizator („incaltaminte_8” → „incaltaminte”). */
export function organizerPictogram(key: string): string {
  return key.split("_")[0];
}

export function hasPictogram(kind: string): boolean {
  return kind in PICTOGRAMS;
}

export function OptionPictogram({ kind, className }: { kind: string; className?: string }) {
  const art = PICTOGRAMS[kind];
  if (!art) return null;
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden>
      <defs>
        <marker id="mobo-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1 1 L8 5 L1 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      {art}
    </svg>
  );
}
