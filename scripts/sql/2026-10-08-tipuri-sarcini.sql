-- Calendarul arată doar ce e planificat cu adevărat (feedback Mobo, 08.10.2026): întâlniri, contractări,
-- măsurări, livrări. Tipurile de sarcină lipsă se adaugă aici; cele existente (Todo, Apel, Măsurare, Livrare)
-- rămân neatinse. Poate rula de oricâte ori: inserează doar ce nu există.

INSERT INTO "TaskType" (name, "updatedAt")
SELECT v.name, now()
FROM (VALUES ('Întâlnire'), ('Contractare')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "TaskType" t WHERE t.name = v.name);
