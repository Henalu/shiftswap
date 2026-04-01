-- Migration: fix missing column-level grants on user_profiles
--
-- Migrations 00023 (job_position_id) and 00028 (signature_url, onboarding_completed_at)
-- added columns to user_profiles but did not update the column-level grants
-- established in 00016. In PostgreSQL column-level GRANT is additive, so we
-- only need to grant the missing columns.

-- SELECT: allow authenticated users to read the new columns
GRANT SELECT (signature_url, onboarding_completed_at, job_position_id)
  ON public.user_profiles TO authenticated;

-- UPDATE: allow authenticated users to update their own signature_url
-- (RLS policy "Users can update own profile" already restricts to own row)
GRANT UPDATE (signature_url)
  ON public.user_profiles TO authenticated;
