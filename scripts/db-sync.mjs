// Aduce schema bazei la zi cu prisma/schema.prisma. Rulează înainte de `next build` pe Vercel,
// iar pe VPS (Docker/Coolify) la pornirea containerului, cu DB_SYNC=1 — la build baza nu e accesibilă.
//
// Fără pasul ăsta, o coloană nouă din schemă ajunge în cod înaintea bazei și orice interogare
// pe tabelul respectiv cade în producție. `prisma db push` fără `--accept-data-loss` aplică doar
// schimbările care nu pierd date (tabele/coloane noi); una distructivă oprește build-ul, iar
// deployment-ul vechi rămâne activ.

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.VERCEL && !process.env.DB_SYNC) process.exit(0);

// integrarea Neon pune prefixul ales la conectare (aici STORAGE_); schema engine vrea conexiunea directă
const url =
  process.env.DATABASE_URL ||
  process.env.STORAGE_DATABASE_URL_UNPOOLED ||
  process.env.STORAGE_POSTGRES_URL_NON_POOLING ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL;

if (!url) {
  console.warn("db-sync: nicio conexiune la bază în variabilele de mediu — schema nu a fost sincronizată.");
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
const push = () => run("npx prisma db push --skip-generate");

// O bază goală (prima pornire pe VPS, un mediu nou) nu are ce migra: schema se creează întâi,
// altfel scripturile din scripts/sql cad pe tabele care încă nu există.
async function tableCount() {
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema()",
    );
    return rows[0].n;
  } finally {
    await prisma.$disconnect();
  }
}
const empty = (await tableCount()) === 0;
if (empty) {
  console.log("db-sync: bază goală — creez schema înainte de migrările de date");
  push();
}

// migrări de date din scripts/sql (în ordinea numelui), ÎNAINTE de push; fiecare e idempotentă
// și se păzește singură (ex. rulează doar dacă lipsește coloana pe care o adaugă)
for (const file of readdirSync("scripts/sql").filter((f) => f.endsWith(".sql")).sort()) {
  console.log(`db-sync: ${file}`);
  run(`npx prisma db execute --url "$DATABASE_URL" --file scripts/sql/${file}`);
}

if (!empty) push();
