-- ID-ul vizibil al clientului devine un număr simplu: 1, 2, 3… (08.10.2026), în locul formei „01/209/09/26”.
--
-- Rulează o singură dată: doar cât timp coloana "humanId" e încă text. Clienții existenți sunt renumerotați
-- în ordinea creării (cei șterși trec la coadă, ca să nu ocupe numerele mici), iar numerele următoare vin
-- dintr-o secvență Postgres — nu se refolosesc niciodată și nu se pot ciocni la două creări simultane.
-- Forma finală e exact cea pe care o așteaptă Prisma pentru `Int @unique @default(autoincrement())`,
-- deci `prisma db push` de după nu mai are nimic de schimbat.

DO $$
DECLARE
  next_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Contact'
      AND column_name = 'humanId' AND data_type = 'text'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "Contact" ADD COLUMN "humanIdNum" INTEGER;

  UPDATE "Contact" c
  SET "humanIdNum" = r.rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ("deletedAt" IS NOT NULL), id) AS rn
    FROM "Contact"
  ) r
  WHERE c.id = r.id;

  -- odată cu coloana veche dispare și indexul ei unic, deci numele poate fi refolosit mai jos
  ALTER TABLE "Contact" DROP COLUMN "humanId";
  ALTER TABLE "Contact" RENAME COLUMN "humanIdNum" TO "humanId";

  CREATE SEQUENCE "Contact_humanId_seq" AS integer OWNED BY "Contact"."humanId";
  SELECT COALESCE(MAX("humanId"), 0) + 1 INTO next_id FROM "Contact";
  PERFORM setval('"Contact_humanId_seq"', next_id, false);

  ALTER TABLE "Contact"
    ALTER COLUMN "humanId" SET DEFAULT nextval('"Contact_humanId_seq"'),
    ALTER COLUMN "humanId" SET NOT NULL;
  CREATE UNIQUE INDEX "Contact_humanId_key" ON "Contact"("humanId");
END $$;
