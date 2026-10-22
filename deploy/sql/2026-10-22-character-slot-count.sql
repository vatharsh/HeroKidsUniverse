-- Characters created before the slot counter existed weren't counted, so some accounts show fewer
-- slots used than characters they have. Slots are never given back on delete, so the counter can
-- only be raised here. Safe to re-run.
UPDATE users u SET "characterSlotsUsed" = c.cnt
  FROM (SELECT "userId", COUNT(*)::int AS cnt FROM characters GROUP BY "userId") c
 WHERE c."userId" = u.id AND u."characterSlotsUsed" < c.cnt;
SELECT u.email, u."characterSlotsUsed", u."characterSlotsTotal",
       (SELECT COUNT(*) FROM characters ch WHERE ch."userId" = u.id) AS characters
  FROM users u WHERE u."deletedAt" IS NULL AND EXISTS (SELECT 1 FROM characters ch WHERE ch."userId" = u.id);
