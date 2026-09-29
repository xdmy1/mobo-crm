import { prisma } from "./db";
import { ymdChisinau } from "./format";

/**
 * Generează ID-ul uman al clientului: `01/209/09/26`
 * = <cod sursă 2 cifre>/<id secvențial>/<lună>/<an scurt>
 */
export async function generateHumanId(sourceId: number | null | undefined): Promise<string> {
  let code = "00";
  if (sourceId) {
    const source = await prisma.contactSource.findUnique({ where: { id: sourceId } });
    if (source?.code) code = source.code.padStart(2, "0");
  }
  // id secvențial global: următorul id de contact
  const last = await prisma.contact.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const seq = (last?.id ?? 0) + 1;
  // luna/anul de la Chișinău, nu din fusul serverului („2026-09-21” → 09 / 26)
  const [yyyy, month] = ymdChisinau().split("-");
  const year = yyyy.slice(-2);
  return `${code}/${seq}/${month}/${year}`;
}
