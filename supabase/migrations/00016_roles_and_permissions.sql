-- Migration: role-based admin scopes and scoped permissions

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ALTER COLUMN role SET DEFAULT 'member';

UPDATE public.user_profiles
SET role = CASE
  WHEN role = 'admin' THEN 'super_admin'
  WHEN role IN ('member', 'department_admin', 'hr_admin', 'super_admin') THEN role
  ELSE 'member'
END;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('member', 'department_admin', 'hr_admin', 'super_admin'));

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_validation_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_validation_status_check
  CHECK (validation_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.user_profiles
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN department_id DROP NOT NULL;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_scope_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_scope_check
  CHECK (
    role = 'super_admin'
    OR (company_id IS NOT NULL AND department_id IS NOT NULL)
  );

UPDATE public.user_profiles
SET is_admin = (role <> 'member')
WHERE is_admin IS DISTINCT FROM (role <> 'member');

CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON public.user_profiles(role);

CREATE INDEX IF NOT EXISTS idx_user_profiles_validation_scope
  ON public.user_profiles(validation_status, company_id, department_id);

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT company_id
  FROM public.user_profiles
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT department_id
  FROM public.user_profiles
  WHERE id = user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_company(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_department(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_department(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in own company" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view approved profiles in own company" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view scoped profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update scoped validation fields" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can update user roles" ON public.user_profiles;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view approved profiles in own company"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    validation_status = 'approved'
    AND company_id = public.get_user_company(auth.uid())
  );

CREATE POLICY "Admins can view scoped profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR (
      public.get_user_role(auth.uid()) = 'hr_admin'
      AND company_id = public.get_user_company(auth.uid())
    )
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND company_id = public.get_user_company(auth.uid())
      AND department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "Admins can update scoped validation fields"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR (
      public.get_user_role(auth.uid()) = 'hr_admin'
      AND company_id = public.get_user_company(auth.uid())
    )
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND company_id = public.get_user_company(auth.uid())
      AND department_id = public.get_user_department(auth.uid())
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR (
      public.get_user_role(auth.uid()) = 'hr_admin'
      AND company_id = public.get_user_company(auth.uid())
    )
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND company_id = public.get_user_company(auth.uid())
      AND department_id = public.get_user_department(auth.uid())
    )
  );

CREATE POLICY "Super admins can update user roles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'super_admin');

REVOKE INSERT, SELECT, UPDATE ON public.user_profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  email,
  full_name,
  company_id,
  department_id,
  role,
  avatar_url,
  phone,
  employee_id,
  id_card_url,
  validation_status,
  validation_notes,
  created_at,
  updated_at
) ON public.user_profiles TO authenticated;

GRANT UPDATE (
  full_name,
  email,
  avatar_url,
  phone
) ON public.user_profiles TO authenticated;
