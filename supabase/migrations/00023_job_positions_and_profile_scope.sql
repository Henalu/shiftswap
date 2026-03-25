-- Migration: job positions scoped to operational departments
-- Goal: support company -> parent department -> operational department -> job position

CREATE TABLE IF NOT EXISTS public.job_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_positions_name_not_blank
    CHECK (BTRIM(name) <> ''),
  CONSTRAINT job_positions_code_not_blank
    CHECK (code IS NULL OR BTRIM(code) <> ''),
  CONSTRAINT job_positions_department_fk
    FOREIGN KEY (company_id, department_id)
    REFERENCES public.departments(company_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_positions_department
  ON public.job_positions(department_id, active, name);

CREATE INDEX IF NOT EXISTS idx_job_positions_company
  ON public.job_positions(company_id, department_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_positions_unique_name_per_department
  ON public.job_positions(department_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_positions_unique_code_per_department
  ON public.job_positions(department_id, code)
  WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_job_position_department_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_department_assignable(NEW.department_id) THEN
    RAISE EXCEPTION 'Job positions can only belong to operational departments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_job_position_department_scope
  ON public.job_positions;

CREATE TRIGGER enforce_job_position_department_scope
BEFORE INSERT OR UPDATE OF company_id, department_id
ON public.job_positions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_job_position_department_scope();

DROP TRIGGER IF EXISTS set_updated_at_job_positions
  ON public.job_positions;

CREATE TRIGGER set_updated_at_job_positions
BEFORE UPDATE ON public.job_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS job_position_id UUID NULL;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_job_position_fk;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_job_position_fk
  FOREIGN KEY (job_position_id)
  REFERENCES public.job_positions(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_job_position
  ON public.user_profiles(job_position_id);

CREATE OR REPLACE FUNCTION public.sync_user_profile_job_position_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_department_id UUID;
  target_company_id UUID;
BEGIN
  IF NEW.job_position_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT job_position.department_id, job_position.company_id
  INTO target_department_id, target_company_id
  FROM public.job_positions AS job_position
  WHERE job_position.id = NEW.job_position_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.department_id IS NULL
     OR NEW.company_id IS NULL
     OR NEW.department_id <> target_department_id
     OR NEW.company_id <> target_company_id THEN
    NEW.job_position_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_profile_job_position_scope
  ON public.user_profiles;

CREATE TRIGGER sync_user_profile_job_position_scope
BEFORE INSERT OR UPDATE OF company_id, department_id, job_position_id
ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profile_job_position_scope();

ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view scoped job positions" ON public.job_positions;

CREATE POLICY "Users can view scoped job positions"
  ON public.job_positions
  FOR SELECT
  TO authenticated
  USING (public.can_access_shift_department(department_id));

REVOKE ALL ON public.job_positions FROM anon, authenticated;
GRANT SELECT ON public.job_positions TO authenticated;

GRANT SELECT (job_position_id) ON public.user_profiles TO authenticated;
