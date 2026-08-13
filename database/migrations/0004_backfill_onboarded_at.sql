-- Users created before onboarded_at existed (0003) all have onboarded_at = NULL, which would
-- incorrectly route them through the new-user onboarding wizard on their next login even though
-- they've already done real setup. Backfill: anyone who already belongs to an organisation has
-- clearly been through some form of setup, so treat them as already onboarded.
UPDATE users
SET onboarded_at = now()
WHERE onboarded_at IS NULL
  AND id IN (SELECT DISTINCT user_id FROM organisation_members);
