-- Migration: Allow all authenticated users to read companies and departments
-- Needed for the registration flow, where users don't have a user_profiles row yet
-- and the existing policies (which check user_profiles) return nothing.

-- Drop the restrictive policies that only work once a profile exists
DROP POLICY IF EXISTS "Users can view own company" ON companies;
DROP POLICY IF EXISTS "Users can view own company departments" ON departments;

-- Allow all authenticated users to view all companies
CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to view all departments
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);
