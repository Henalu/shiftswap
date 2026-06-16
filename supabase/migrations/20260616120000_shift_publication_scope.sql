-- Let a shift publication choose a company-valid operational department
-- and, optionally, the job position it is being published for.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS job_position_id UUID NULL
  REFERENCES public.job_positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_job_position
  ON public.shifts(job_position_id)
  WHERE job_position_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_shift_publication_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_company_id UUID;
  shift_company_id UUID;
  selected_position public.job_positions%ROWTYPE;
BEGIN
  SELECT profile.company_id
  INTO owner_company_id
  FROM public.user_profiles AS profile
  WHERE profile.id = NEW.user_id;

  SELECT department.company_id
  INTO shift_company_id
  FROM public.departments AS department
  WHERE department.id = NEW.department_id;

  IF owner_company_id IS NULL OR shift_company_id IS NULL THEN
    RAISE EXCEPTION 'Shift publication requires a valid company scope';
  END IF;

  IF owner_company_id <> shift_company_id THEN
    RAISE EXCEPTION 'Shift publication department must belong to the owner company';
  END IF;

  IF NOT public.is_department_assignable(NEW.department_id) THEN
    RAISE EXCEPTION 'Shift publication department must be operational';
  END IF;

  IF NEW.job_position_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO selected_position
  FROM public.job_positions
  WHERE id = NEW.job_position_id;

  IF NOT FOUND
     OR selected_position.active IS DISTINCT FROM TRUE
     OR selected_position.company_id <> shift_company_id
     OR selected_position.department_id <> NEW.department_id THEN
    RAISE EXCEPTION 'Shift publication job position must belong to the selected department';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_shift_publication_scope
  ON public.shifts;

CREATE TRIGGER enforce_shift_publication_scope
BEFORE INSERT OR UPDATE OF user_id, department_id, job_position_id
ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shift_publication_scope();

DROP POLICY IF EXISTS "Users can create own shifts" ON public.shifts;

CREATE POLICY "Users can create own shifts"
  ON public.shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.departments AS department
      WHERE department.id = shifts.department_id
        AND department.company_id = public.get_user_company(auth.uid())
        AND public.is_department_assignable(department.id)
    )
    AND (
      job_position_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.job_positions AS job_position
        WHERE job_position.id = shifts.job_position_id
          AND job_position.company_id = public.get_user_company(auth.uid())
          AND job_position.department_id = shifts.department_id
          AND job_position.active = TRUE
      )
    )
    AND (
      direct_recipient_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles AS recipient
        WHERE recipient.id = direct_recipient_id
          AND recipient.validation_status = 'approved'
          AND recipient.company_id = public.get_user_company(auth.uid())
      )
    )
  );
