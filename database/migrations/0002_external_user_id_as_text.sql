-- responses.user_id and events.user_id were modeled as UUID REFERENCES users(id) — a foreign key
-- to FeedbackHub's own dashboard login accounts. But these columns hold the *host website's own*
-- end-user identifier, passed through FeedbackHub.identify({ userId }) by the embedded SDK — an
-- arbitrary string from the customer's own system (e.g. "cus_12345"), never a FeedbackHub account.
-- As shipped, any identify() call with a non-UUID id (the common case) made every subsequent
-- response submission or tracked event fail: Zod's z.string().uuid() rejected it outright, and
-- even a UUID-shaped id would violate the FK unless it happened to match a real dashboard user.
-- Fix: drop the FK and widen the column to a free-form external identifier, consistent with how
-- anonymous_id/session_id are already modeled as unconstrained TEXT.

ALTER TABLE responses DROP CONSTRAINT responses_user_id_fkey;
ALTER TABLE responses ALTER COLUMN user_id TYPE TEXT USING user_id::text;

ALTER TABLE events DROP CONSTRAINT events_user_id_fkey;
ALTER TABLE events ALTER COLUMN user_id TYPE TEXT USING user_id::text;
