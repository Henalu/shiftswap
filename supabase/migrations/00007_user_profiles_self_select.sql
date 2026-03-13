-- Migration: Add direct self-select policy for user_profiles
--
-- Root cause: The only existing SELECT policy is self-referential:
--   USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
-- If auth.uid() returns null in the DB context (JWT not reaching PostgREST),
-- the subquery returns 0 rows → IN () is always false → RLS denies silently → profile = null.
--
-- Fix: add a direct policy so users can always read their own row regardless of JWT issues
-- with the recursive subquery.

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());
