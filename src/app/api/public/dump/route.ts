import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, checkApiKey } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORAR (mutarea pe VPS, 08.10.2026): export brut al tuturor tabelelor, rând cu rând,
 * ca JSON — se importă cu scripts/import-dump.mjs. Protejat cu același PUBLIC_API_KEY ca
 * restul API-ului public. Se șterge imediat după migrare.
 */
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) return bad("API key invalid", 401);

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const out: Record<string, unknown[]> = {};
  for (const { table_name } of tables) {
    if (table_name.startsWith("_prisma")) continue;
    const rows = await prisma.$queryRawUnsafe<{ j: unknown }[]>(
      `SELECT row_to_json(t) AS j FROM "${table_name.replace(/"/g, "")}" t`,
    );
    out[table_name] = rows.map((r) => r.j);
  }
  const sequences = await prisma.$queryRawUnsafe<{ name: string; value: string | null }[]>(
    `SELECT sequencename AS name, last_value::text AS value FROM pg_sequences WHERE schemaname = current_schema()`,
  );
  return NextResponse.json({ exportedAt: new Date().toISOString(), tables: out, sequences });
}
