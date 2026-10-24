-- Where a purchase was made (e.g. 'quota_card' = the "free stories are all given out" card).
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS source text;
