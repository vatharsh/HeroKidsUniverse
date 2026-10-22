-- Pre-launch: every existing account is a test account (2-story limit, data counted as test).
-- At go-live, un-tick "Test account" in Admin → Users for any real customer who signed up early.
UPDATE users SET "isTestAccount" = true WHERE "deletedAt" IS NULL AND "isTestAccount" = false;
SELECT role, count(*) AS accounts, count(*) FILTER (WHERE "isTestAccount") AS test_accounts
  FROM users WHERE "deletedAt" IS NULL GROUP BY role ORDER BY role;
