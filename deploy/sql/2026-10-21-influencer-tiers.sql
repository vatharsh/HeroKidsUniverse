-- Global influencer commission tiers capped at 15% (was 10/12/15/20 at 0/100/200/500 orders).
-- With a 10% coupon, total marketing cost stays near 25% of a sale. Old rules are soft-deleted,
-- same as saving from Admin → Influencers → Commission Settings. Per-influencer overrides are untouched.
BEGIN;
UPDATE influencer_commission_rules SET "isDeleted" = true, "deletedAt" = now()
 WHERE "influencerId" IS NULL AND "isDeleted" = false;
INSERT INTO influencer_commission_rules ("influencerId", "minSuccessfulOrders", "commissionRate", "isActive")
VALUES (NULL, 0, 10, true), (NULL, 100, 12, true), (NULL, 250, 15, true);
COMMIT;
SELECT "minSuccessfulOrders", "commissionRate" FROM influencer_commission_rules
 WHERE "influencerId" IS NULL AND "isDeleted" = false ORDER BY 1;
