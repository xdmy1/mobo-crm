// Importă dump-ul JSON produs de /api/public/dump într-o bază cu schema deja creată (db push).
// Rulează în containerul CRM: node scripts/import-dump.mjs /tmp/dump.json
// Golește tabelele, inserează rândurile cu ID-urile originale (verificările de chei străine
// sunt suspendate pe durata tranzacției), apoi aliniază secvențele.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
if (!file) {
  console.error("folosire: node scripts/import-dump.mjs <dump.json>");
  process.exit(1);
}
const dump = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();
const q = (name) => `"${name.replace(/"/g, "")}"`;

await prisma.$transaction(
  async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const names = Object.keys(dump.tables);
    await tx.$executeRawUnsafe(`TRUNCATE ${names.map(q).join(", ")} CASCADE`);
    let total = 0;
    for (const name of names) {
      const rows = dump.tables[name];
      if (!rows.length) continue;
      await tx.$executeRawUnsafe(
        `INSERT INTO ${q(name)} SELECT * FROM json_populate_recordset(NULL::${q(name)}, $1::json)`,
        JSON.stringify(rows),
      );
      total += rows.length;
      console.log(`${name}: ${rows.length}`);
    }
    for (const s of dump.sequences) {
      if (s.value == null) continue;
      await tx.$executeRawUnsafe(`SELECT setval($1, $2::bigint, true)`, `"${s.name}"`, s.value);
    }
    console.log(`import: ${total} rânduri în ${names.length} tabele, ${dump.sequences.length} secvențe`);
  },
  { timeout: 300_000, maxWait: 20_000 },
);
await prisma.$disconnect();
