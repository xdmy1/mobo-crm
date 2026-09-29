import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/** Jurnal de audit [NOU]: cine a modificat ce și când. */
export async function audit(
  staffId: number | null | undefined,
  action: string,
  entity: string,
  entityId?: string | number | null,
  meta?: Prisma.InputJsonValue
) {
  try {
    await prisma.auditLog.create({
      data: {
        staffId: staffId ?? null,
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        meta: meta ?? undefined,
      },
    });
  } catch {
    // auditul nu blochează operațiunea principală
  }
}
