-- Tracks whether a user has completed the onboarding wizard, so the dashboard can show it exactly
-- once (on genuine first access) instead of re-deriving "is this a new user?" from current state
-- like organisation count, which also matches an existing user who later left their only org.
ALTER TABLE users ADD COLUMN onboarded_at TIMESTAMPTZ;
