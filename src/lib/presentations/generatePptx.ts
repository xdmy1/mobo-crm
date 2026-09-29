// Prezentarea PPTX = șablonul unic (deck.ts) randat pentru PowerPoint / Keynote, cu animații.

import { buildDeck } from "./deck";
import { renderDeckPptx } from "./renderPptx";
import type { PresentationData } from "./data";

export async function generatePresentationPptx(d: PresentationData): Promise<Buffer> {
  return renderDeckPptx(await buildDeck(d));
}
