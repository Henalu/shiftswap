-- Migration: job position change requests with scoped approval flow
-- Goal: let employees request job-position changes within their operational department

CREATE TABLE IF NOT EXISTS public.job_position_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  current_department_id UUID NOT NULL,
  current_job_position_id UUID NULL REFERENCES public.job_positions(id) ON DELETE SET NULL,
  requested_job_position_id UUID NOT NULL REFERENCES public.job_positions(id) ON DELETE RESTRICT,
  request_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_position_change_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT job_position_change_requests_department_fk
    FOREIGN KEY (company_id, current_department_id)
    REFERENCES public.departments(company_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT job_position_change_requests_positions_different
    CHECK (
      current_job_position_id IS NULL
      OR current_job_position_id <> requested_job_position_id
    )
);

CREATE INDEX IF NOT EXISTS idx_job_position_change_requests_user
  ON public.job_position_change_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_position_change_requests_status
  ON public.job_position_change_requests(company_id, current_department_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_position_change_requests_one_pending
  ON public.job_position_change_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.can_request_job_position_change(
  target_company_id UUID,
  current_department UUID,
  requested_position UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_positions AS job_position
    WHERE job_position.id = requested_position
      AND job_position.company_id = target_company_id
      AND job_position.department_id = current_department
      AND job_position.active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_job_position_change_request_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_position public.job_positions%ROWTYPE;
  current_position public.job_positions%ROWTYPE;
BEGIN
  SELECT *
  INTO requested_position
  FROM public.job_positions
  WHERE id = NEW.requested_job_position_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requested job position not found';
  END IF;

  IF requested_position.company_id <> NEW.company_id
     OR requested_position.department_id <> NEW.current_department_id THEN
    RAISE EXCEPTION 'Requested job position is outside the current department scope';
  END IF;

  IF requested_position.active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Requested job position is not active';
  END IF;

  IF NEW.current_job_position_id IS NOT NULL THEN
    SELECT *
    INTO current_position
    FROM public.job_positions
    WHERE id = NEW.current_job_position_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Current job position not found';
    END IF;

    IF current_position.company_id <> NEW.company_id
       OR current_position.department_id <> NEW.current_department_id THEN
      RAISE EXCEPTION 'Current job position is outside the current department scope';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_job_position_change_request_scope
  ON public.job_position_change_requests;

CREATE TRIGGER enforce_job_position_change_request_scope
BEFORE INSERT OR UPDATE OF company_id, current_department_id, current_job_position_id, requested_job_position_id
ON public.job_position_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_job_position_change_request_scope();

CREATE OR REPLACE FUNCTION public.resolve_job_position_change_request(
  target_request_id UUID,
  next_status TEXT,
  review_notes_input TEXT DEFAULT NULL
)
RETURNS public.job_position_change_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.job_position_change_requests%ROWTYPE;
  reviewer_id UUID;
  target_profile public.user_profiles%ROWTYPE;
  requested_position public.job_positions%ROWTYPE;
BEGIN
  reviewer_id := auth.uid();

  IF reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF next_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid job position change status: %', next_status;
  END IF;

  SELECT *
  INTO request_row
  FROM public.job_position_change_requests
  WHERE id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job position change request not found';
  END IF;

  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Job position change request is no longer pending';
  END IF;

  IF request_row.user_id = reviewer_id THEN
    RAISE EXCEPTION 'You cannot resolve your own job position change request';
  END IF;

  IF NOT public.can_access_department_scope(
    request_row.company_id,
    request_row.current_department_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to review this job position change request';
  END IF;

  IF next_status = 'approved' THEN
    SELECT *
    INTO target_profile
    FROM public.user_profiles
    WHERE id = request_row.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'User profile not found';
    END IF;

    IF target_profile.company_id IS DISTINCT FROM request_row.company_id
       OR target_profile.department_id IS DISTINCT FROM request_row.current_department_id THEN
      RAISE EXCEPTION 'The employee no longer belongs to the original department scope';
    END IF;

    SELECT *
    INTO requested_position
    FROM public.job_positions
    WHERE id = request_row.requested_job_position_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Requested job position not found';
    END IF;

    IF requested_position.company_id <> request_row.company_id
       OR requested_position.department_id <> request_row.current_department_id
       OR requested_position.active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Requested job position is no longer available for approval';
    END IF;

    UPDATE public.user_profiles
    SET job_position_id = request_row.requested_job_position_id
    WHERE id = request_row.user_id;
  END IF;

  UPDATE public.job_position_change_requests
  SET
    status = next_status,
    reviewed_by = reviewer_id,
    reviewed_at = NOW(),
    review_notes = NULLIF(BTRIM(review_notes_input), '')
  WHERE id = target_request_id
  RETURNING *
  INTO request_row;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_job_position_changes_on_scope_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    UPDATE public.job_position_change_requests
    SET
      status = 'cancelled',
      reviewed_at = NOW(),
      review_notes = COALESCE(
        review_notes,
        'Cancelada automaticamente porque cambió el departamento o el ámbito laboral del perfil.'
      )
    WHERE user_id = NEW.id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_job_position_change_requests
  ON public.job_position_change_requests;

CREATE TRIGGER set_updated_at_job_position_change_requests
BEFORE UPDATE ON public.job_position_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS cancel_pending_job_position_changes_on_scope_change
  ON public.user_profiles;

CREATE TRIGGER cancel_pending_job_position_changes_on_scope_change
AFTER UPDATE OF company_id, department_id
ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.cancel_pending_job_position_changes_on_scope_change();

REVOKE ALL ON FUNCTION public.can_request_job_position_change(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_job_position_change_request(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_request_job_position_change(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_job_position_change_request(UUID, TEXT, TEXT) TO authenticated;

ALTER TABLE public.job_position_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job position change requests"
  ON public.job_position_change_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view scoped job position change requests"
  ON public.job_position_change_requests
  FOR SELECT
  TO authenticated
  USING (public.can_access_department_scope(company_id, current_department_id));

CREATE POLICY "Users can create own job position change requests"
  ON public.job_position_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company(auth.uid())
    AND current_department_id = public.get_user_department(auth.uid())
    AND (
      current_job_position_id IS NULL
      OR current_job_position_id = (
        SELECT profile.job_position_id
        FROM public.user_profiles AS profile
        WHERE profile.id = auth.uid()
      )
    )
    AND public.can_request_job_position_change(
      company_id,
      current_department_id,
      requested_job_position_id
    )
    AND (
      current_job_position_id IS NULL
      OR requested_job_position_id <> current_job_position_id
    )
  );

GRANT SELECT, INSERT ON public.job_position_change_requests TO authenticated;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'shift_request',
      'request_accepted',
      'request_rejected',
      'shift_cancelled',
      'new_message',
      'exchange_confirmed',
      'exchange_signed',
      'exchange_document_added',
      'exchange_cancelled',
      'exchange_cancellation_requested',
      'exchange_cancellation_rejected',
      'exchange_pending_approval',
      'exchange_department_approved',
      'exchange_department_rejected',
      'account_approved',
      'account_rejected',
      'department_change_requested',
      'department_change_approved',
      'department_change_rejected',
      'job_position_change_requested',
      'job_position_change_approved',
      'job_position_change_rejected'
    )
  );
