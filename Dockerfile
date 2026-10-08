# syntax=docker/dockerfile:1.7
# Imaginea CRM-ului pentru VPS (Coolify). Pe Vercel fișierul e ignorat.
#
# Două etape: build cu toate dependențele (next build are nevoie de typescript
# etc.), apoi o imagine de rulare cu dependențele de producție. Schema bazei se
# aduce la zi la PORNIREA containerului (scripts/db-sync.mjs cu DB_SYNC=1), nu
# la build — la build baza nu e accesibilă.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
# postinstall rulează `prisma generate`, deci schema trebuie să existe deja
COPY prisma ./prisma
RUN npm ci
COPY . .
# Variabilele NEXT_PUBLIC_* intră în bundle la build — în Coolify se marchează „Build Variable”.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN npm run build && npm prune --omit=dev

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app ./
# fișierele vechi de pe disc (înainte de StoredFile) — opțional, montat ca volum
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "DB_SYNC=1 node scripts/db-sync.mjs && npx next start -p 3000"]
