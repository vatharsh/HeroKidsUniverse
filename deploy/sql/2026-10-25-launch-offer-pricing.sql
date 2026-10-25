-- Launch offer: ₹499 / ₹999 until 30 days after go-live, then ₹599 / ₹1,199 (₹699 / ₹1,499 shown crossed out).
-- The 30-day clock starts automatically when Sandbox Mode is turned off.
BEGIN;
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS "afterPromotionPrice" numeric(10,2);
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS "endsDaysAfterLaunch" integer;
UPDATE credit_packs SET "promotionName" = 'Launch offer', "afterPromotionPrice" = 599, "endsDaysAfterLaunch" = 30, "promotionEnd" = NULL
 WHERE name = 'Family Pack' AND "isDeleted" = false;
UPDATE credit_packs SET "promotionName" = 'Launch offer', "afterPromotionPrice" = 1199, "endsDaysAfterLaunch" = 30, "promotionEnd" = NULL, "bonusCredits" = 2
 WHERE name = 'Birthday Pack' AND "isDeleted" = false;
COMMIT;
