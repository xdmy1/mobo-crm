// Prezentarea PDF = același șablon (deck.ts), pagină cu pagină — pentru trimis pe WhatsApp / email.

import { buildDeck } from "./deck";
import { renderDeckPdf } from "./renderPdf";
import type { PresentationData } from "./data";

export async function generatePresentationPdf(d: PresentationData): Promise<Buffer> {
  return renderDeckPdf(await buildDeck(d));
}
