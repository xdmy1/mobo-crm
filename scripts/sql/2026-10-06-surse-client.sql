-- Sursele clientului reduse la lista cerută de Mobo (06.10.2026):
-- Site, Apel direct, Showroom, Instagram, Facebook, Partener, Recomandare.
--
-- Rulează o singură dată: adaugă coloana "order" în același bloc, iar dacă ea există deja nu face nimic
-- (deci o sursă adăugată mai târziu din Setup nu e atinsă la deploy-urile următoare).
-- Codurile vechi rămân pe loc → ID-urile umane deja emise își păstrează sensul.

DO $$
DECLARE
  pair text[];
  target_id int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ContactSource' AND column_name = 'order'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "ContactSource" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

  -- redenumiri; dacă numele nou există deja, clienții trec pe el și sursa veche dispare
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['Site Web', 'Site'],
    ['Recomandare partener', 'Partener'],
    ['Recomandare client', 'Recomandare'],
    ['Recomandare Internă', 'Recomandare']
  ] LOOP
    SELECT id INTO target_id FROM "ContactSource" WHERE name = pair[2] ORDER BY id LIMIT 1;
    IF target_id IS NULL THEN
      UPDATE "ContactSource" SET name = pair[2], "updatedAt" = now()
      WHERE id = (SELECT id FROM "ContactSource" WHERE name = pair[1] ORDER BY id LIMIT 1);
    ELSE
      UPDATE "Contact" SET "sourceId" = target_id
      WHERE "sourceId" IN (SELECT id FROM "ContactSource" WHERE name = pair[1]);
      DELETE FROM "ContactSource" WHERE name = pair[1];
    END IF;
  END LOOP;

  -- Tik-tok nu mai e în listă: clienții rămân fără sursă (codul 05 din ID-ul lor arată de unde au venit)
  UPDATE "Contact" SET "sourceId" = NULL
  WHERE "sourceId" IN (SELECT id FROM "ContactSource" WHERE name = 'Tik-tok');
  DELETE FROM "ContactSource" WHERE name = 'Tik-tok';

  -- lista finală, în ordinea dorită: [nume, cod ID, ordine]
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['Site', '01', '1'],
    ['Apel direct', '02', '2'],
    ['Showroom', '09', '3'],
    ['Instagram', '03', '4'],
    ['Facebook', '04', '5'],
    ['Partener', '07', '6'],
    ['Recomandare', '06', '7']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM "ContactSource" WHERE name = pair[1]) THEN
      INSERT INTO "ContactSource" (name, code, "updatedAt") VALUES (pair[1], pair[2], now());
    END IF;
    UPDATE "ContactSource" SET "order" = pair[3]::int WHERE name = pair[1];
  END LOOP;

  -- alte surse create între timp din Setup rămân, la coada listei
  UPDATE "ContactSource" SET "order" = 100 WHERE "order" = 0;
END $$;
