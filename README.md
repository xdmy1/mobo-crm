# MOBO CRM

CRM complet pentru **Mobo kitchens & home** — producător de bucătării și mobilă la comandă (Chișinău, Moldova). Reconstruit 1:1 după aplicația `crm.mobo.md`, plus îmbunătățirile marcate **[NOU]** în specificație.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · PostgreSQL · iron-session · pdfkit · docx · web-push · nodemailer. Fără servicii externe — totul rulează self-hosted pe VPS.

---

## Pornire rapidă (local)

```bash
# 1. PostgreSQL pornit local + baza de date
createdb mobo_crm

# 2. Instalare + schema + seed
npm install
cp .env.example .env        # completează DATABASE_URL, SESSION_SECRET etc.
npx prisma db push
npx prisma db seed

# 3. Rulare
npm run dev                 # sau: npm run build && npm start
```

Autentificare implicită: **admin / admin123** (schimb-o imediat din Setup → Lista Angajați).

## Variabile de mediu (`.env`)

| Variabilă | Descriere |
|---|---|
| `DATABASE_URL` | `postgresql://user:parola@localhost:5432/mobo_crm` |
| `SESSION_SECRET` | minim 32 caractere — semnează cookie-ul de sesiune |
| `PUBLIC_API_KEY` | cheia pentru endpoint-urile publice (formular site / calculator) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (`npx web-push generate-vapid-keys`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | aceeași cheie publică, expusă clientului |
| `UPLOADS_DIR` | directorul de fișiere (implicit `./uploads`) — include-l în backup |
| `NEXT_PUBLIC_APP_URL` | URL-ul public al aplicației |

## Deploy pe VPS

### Varianta Docker

```bash
docker compose up -d --build     # app + postgres, vezi docker-compose.yml
docker compose exec app npx prisma db push
docker compose exec app npx prisma db seed
```

### Varianta clasică (systemd + nginx)

```bash
# pe VPS (Ubuntu/Debian): Node 20+, PostgreSQL 15+
git clone <repo> /opt/mobo-crm && cd /opt/mobo-crm
npm ci && npx prisma db push && npx prisma db seed && npm run build
# rulează `npm start` sub systemd; pune nginx în față cu proxy_pass la :3000
```

Backup zilnic recomandat (cron): `pg_dump mobo_crm | gzip > backup.sql.gz` + arhivarea folderului `uploads/`.

## Structura

```
prisma/schema.prisma      # toate entitățile (35+ modele) — sursa diagramei ER
prisma/seed.ts            # roluri+permisiuni, etape, surse, camere+elemente,
                          # catalog prețuri, plan de conturi, produse, clienți demo
src/lib/calc/             # motorul de calcul al estimării (pur, testat)
src/lib/pdf/  src/lib/docx/  # Contract RO/RU, Ofertă RO/RU, Estimare tabel, Predat/Preluat
src/server/registry.ts    # whitelist CRUD generic per entitate + hooks (notificări)
src/server/lists.ts       # interogările tuturor listelor (partajate cu /api/export)
src/components/table/ListShell.tsx   # shell-ul comun de tabel (§3 din spec)
src/components/wizard/QuoteWizard.tsx # wizard-ul în 13 pași (12 + Organizatoare [NOU])
src/app/admin/(app)/      # toate paginile: calendar, dashboard, kanban ×2, estimări,
                          # produse, clienți, camere, proiecte, contracte, oferte,
                          # finanțe, mesaje, atașamente, sarcini, email, pdf-view,
                          # notificări, setup (35 rute)
src/app/api/public/       # endpoint-uri site: /api/public/lead, /api/public/calculator
```

## Endpoint-uri publice (integrare site mobo.md)

Ambele cer header `X-Api-Key: <PUBLIC_API_KEY>`, au rate-limiting per IP și deduplicare după telefon.

```bash
# Formularul „Cerere de pe site” → Client (Lead, Site Web) + Cameră Default
#   + Proiect „Cerere de pe site” + „Estimare la preț 0.00”
curl -X POST https://crm.exemplu.md/api/public/lead \
  -H "Content-Type: application/json" -H "X-Api-Key: $KEY" \
  -d '{"firstName":"Ion","lastName":"Popescu","phone":"+37369000000","email":"ion@mail.md"}'

# Calculatorul public de preț → același flux + estimare calculată din config
curl -X POST https://crm.exemplu.md/api/public/calculator \
  -H "Content-Type: application/json" -H "X-Api-Key: $KEY" \
  -d '{"firstName":"Ana","lastName":"Rusu","phone":"+37378000000",
       "config":{"qualityLevel":"STANDARD","furnitureType":"BUCATARIE",
                 "lengthMm":3000,"heightMm":2400,"depth":600,
                 "bodyBrand":"PAL_EGGER","bodyFinish":"COLOR","facade":"MDF_1P",
                 "worktop":{"material":"PAL_EGGER","sqm":3}}}'
```

## Reguli de business cheie

- **ID uman client:** `01/209/09/26` = cod sursă (2 cifre, Setup → Sursă Client) / id secvențial / lună / an.
- **Tranziții etape (Bord Vânzări):** configurabile per etapă în Setup → Etapa [NOU]:
  „Contractat” și „Predat Producere” cer contract + Proiect2D + Proiect3D; „Eșuat” cere cauza eșecului; „Prezentare” notifică responsabilul.
- **Formula estimării** (Setup → Setări de Calcule, cu istoric versiuni [NOU]):
  `cost = Σ componente` → `ofertare = cost × coef(tip) × coef(premium)` → reducerea nu poate coborî sub cost. Conversie €/MDL la cursul din catalog.
- **Bord Finanțe:** Profit = Suma contract − Partener% − Designer% − QC − Cadou − Reducere − Sinecost. Procentele sunt configurabile în Setup → Organizație [NOU]. Vizibil doar rolurilor cu permisiunea `readAll-finances`.

## Stratul financiar (parolă + 2FA)

Bord Finanțe, plățile, account-urile, tranzacțiile, rapoartele contabile, exportul lor și backup-ul
formează „stratul financiar”. El se deschide doar când sunt îndeplinite toate trei:

1. rolul are permisiunea modulului (`readAll-finances`, `readAll-account`, `readAll-transaction`);
2. utilizatorul are autentificare în doi pași configurată (`/admin/security`, TOTP: Google Authenticator, Authy, 1Password);
3. sesiunea a fost deblocată recent cu **parola + codul 2FA** (lacătul din bara de sus) — deblocarea ține 15 minute.

Fără deblocare, și administratorul vede exact cât un angajat obișnuit. Angajații fără permisiuni financiare
lucrează normal cu clienții (proiecte, camere, estimări, contracte), dar serverul nu le trimite date financiare.
Filtrarea e pe server (`src/lib/financeAccess.ts`): paginile nu încarcă datele, acțiunile refuză, `/api/export` și
`/api/backup` răspund 403. Fiecare deblocare, blocare, activare/dezactivare 2FA și încercare eșuată ajunge în `AuditLog`.

Secretele TOTP stau criptate (AES-256-GCM) cu o cheie derivată din `TOTP_SECRET_KEY` sau, în lipsă, din
`SESSION_SECRET`: schimbarea acelei chei invalidează toate 2FA-urile existente (utilizatorii le reconfigurează).
Un administrator poate reseta 2FA-ul unui coleg care și-a pierdut telefonul, din aceeași pagină.

## Teste

```bash
npm test        # vitest — motorul de calcul (cazul de referință 3000×2400 MDF 1P etc.)
```

## Conturi seed

| Utilizator | Rol |
|---|---|
| `admin` | admin (toate permisiunile) |
| `stoian.iurii` | Manager Operațional |
| `manager.vanzari` | Manager Vânzări |
| `producere` | Manager Producere |
| `contabil` | Contabil (vede Bord Finanțe) |
| `designer.corina` | Designer |

Toți cu parola `admin123`.
