// Rulează înainte de `next build`, DOAR pe Vercel: aduce schema bazei Neon la zi cu prisma/schema.prisma.
//
// Fără pasul ăsta, o coloană nouă din schemă ajunge în cod înaintea bazei și orice interogare
// pe tabelul respectiv cade în producție. `prisma db push` fără `--accept-data-loss` aplică doar
// schimbările care nu pierd date (tabele/coloane noi); una distructivă oprește build-ul, iar
// deployment-ul vechi rămâne activ.

import { execSync } from "node:child_process";

if (!process.env.VERCEL) process.exit(0);

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

execSync("npx prisma db push --skip-generate", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
