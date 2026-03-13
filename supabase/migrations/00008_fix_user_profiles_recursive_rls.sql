-- Migration: Fix infinite recursion (42P17) in user_profiles SELECT policy
--
-- The policy "Users can view profiles in own company" uses a self-referential subquery:
--   USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
-- PostgreSQL evaluates ALL SELECT policies with OR. Even though the simple
-- "Users can view own profile" (id = auth.uid()) would short-circuit logically,
-- PostgreSQL still evaluates the recursive policy and raises 42P17.
--
-- Fix: drop the recursive policy, create a SECURITY DEFINER function that reads
-- user_profiles bypassing RLS (no recursion), and use it in a new company policy.

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Users can view profiles in own company" ON user_profiles;

-- 2. Helper function: returns the company_id of the authenticated user.
--    SECURITY DEFINER runs as the function owner (bypasses RLS → no recursion).
--    SET search_path = public prevents search_path hijacking.
CREATE OR REPLACE FUNCTION get_auth_user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 3. New non-recursive company-wide visibility policy
CREATE POLICY "Users can view profiles in own company"
  ON user_profiles FOR SELECT
  USING (company_id = get_auth_user_company_id());
