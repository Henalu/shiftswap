-- Migration: operational department eligibility, scoped shift visibility,
-- and department change requests

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN NOT NULL DEFAULT TRUE;

WITH parent_departments AS (
  SELECT DISTINCT parent_department_id AS id
  FROM public.departments
  WHERE parent_department_id IS NOT NULL
)
UPDATE public.departments AS department
SET is_assignable = FALSE
FROM parent_departments
WHERE department.id = parent_departments.id;

CREATE INDEX IF NOT EXISTS idx_departments_assignable
  ON public.departments(company_id, is_assignable, parent_department_id);

CREATE OR REPLACE FUNCTION public.is_department_assignable(target_department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.departments AS department
    WHERE department.id = target_department_id
      AND department.is_assignable = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM public.departments AS child
        WHERE child.parent_department_id = department.id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_department_scope(
  target_company_id UUID,
  target_department_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN FALSE
    WHEN public.get_user_role(auth.uid()) = 'super_admin' THEN TRUE
    WHEN public.get_user_role(auth.uid()) = 'hr_admin' THEN (
      target_company_id = public.get_user_company(auth.uid())
    )
    WHEN public.get_user_role(auth.uid()) IN ('member', 'department_admin') THEN (
      target_company_id = public.get_user_company(auth.uid())
      AND target_department_id = public.get_user_department(auth.uid())
    )
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_shift_department(target_department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT public.can_access_department_scope(
      department.company_id,
      department.id
    )
    FROM public.departments AS department
    WHERE department.id = target_department_id
  ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.can_review_department_change_request(
  target_company_id UUID,
  current_department UUID,
  requested_department UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN FALSE
    WHEN public.get_user_role(auth.uid()) = 'super_admin' THEN TRUE
    WHEN public.get_user_role(auth.uid()) = 'hr_admin' THEN (
      target_company_id = public.get_user_company(auth.uid())
    )
    WHEN public.get_user_role(auth.uid()) = 'department_admin' THEN (
      target_company_id = public.get_user_company(auth.uid())
      AND (
        current_department = public.get_user_department(auth.uid())
        OR requested_department = public.get_user_department(auth.uid())
      )
    )
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.is_department_assignable(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_department_scope(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_shift_department(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_review_department_change_request(UUID, UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_department_assignable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_department_scope(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_shift_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_department_change_request(UUID, UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view shifts in own company" ON public.shifts;
DROP POLICY IF EXISTS "Users can create own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can update own shifts" ON public.shifts;

CREATE POLICY "Users can view scoped shifts"
  ON public.shifts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_access_shift_department(department_id)
  );

CREATE POLICY "Users can create own shifts"
  ON public.shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND department_id = public.get_user_department(auth.uid())
    AND public.is_department_assignable(department_id)
  );

CREATE POLICY "Users can update own shifts"
  ON public.shifts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create requests" ON public.shift_requests;

CREATE POLICY "Users can create requests"
  ON public.shift_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    interested_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shifts AS shift
      WHERE shift.id = shift_requests.shift_id
        AND shift.user_id <> auth.uid()
        AND shift.status = 'open'
        AND public.can_access_shift_department(shift.department_id)
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (participant_a_id = auth.uid() OR participant_b_id = auth.uid())
    AND shift_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.shifts AS shift
      JOIN public.shift_requests AS request
        ON request.shift_id = shift.id
      WHERE shift.id = conversations.shift_id
        AND shift.user_id IN (participant_a_id, participant_b_id)
        AND request.interested_user_id IN (participant_a_id, participant_b_id)
        AND request.interested_user_id <> shift.user_id
        AND request.status IN ('pending', 'accepted')
    )
  );

DROP POLICY IF EXISTS "Shift owner can create exchanges" ON public.exchanges;

CREATE POLICY "Shift owner can create exchanges"
  ON public.exchanges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_a_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.shifts AS shift
      JOIN public.shift_requests AS request
        ON request.shift_id = shift.id
       AND request.interested_user_id = exchanges.user_b_id
      WHERE shift.id = exchanges.shift_id
        AND shift.user_id = auth.uid()
        AND request.status = 'accepted'
    )
  );

CREATE TABLE IF NOT EXISTS public.department_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  current_department_id UUID NOT NULL,
  requested_department_id UUID NOT NULL,
  request_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT department_change_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT department_change_requests_departments_different
    CHECK (current_department_id <> requested_department_id),
  CONSTRAINT department_change_requests_current_department_fk
    FOREIGN KEY (company_id, current_department_id)
    REFERENCES public.departments(company_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT department_change_requests_requested_department_fk
    FOREIGN KEY (company_id, requested_department_id)
    REFERENCES public.departments(company_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_department_change_requests_user
  ON public.department_change_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_department_change_requests_status
  ON public.department_change_requests(company_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_department_change_requests_one_pending
  ON public.department_change_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.resolve_department_change_request(
  target_request_id UUID,
  next_status TEXT,
  review_notes_input TEXT DEFAULT NULL
)
RETURNS public.department_change_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.department_change_requests%ROWTYPE;
  reviewer_id UUID;
BEGIN
  reviewer_id := auth.uid();

  IF reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF next_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid department change status: %', next_status;
  END IF;

  SELECT *
  INTO request_row
  FROM public.department_change_requests
  WHERE id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department change request not found';
  END IF;

  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Department change request is no longer pending';
  END IF;

  IF NOT public.can_review_department_change_request(
    request_row.company_id,
    request_row.current_department_id,
    request_row.requested_department_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to review this department change request';
  END IF;

  IF next_status = 'approved' THEN
    IF NOT public.is_department_assignable(request_row.requested_department_id) THEN
      RAISE EXCEPTION 'Requested department is not assignable';
    END IF;

    UPDATE public.user_profiles
    SET department_id = request_row.requested_department_id
    WHERE id = request_row.user_id;
  END IF;

  UPDATE public.department_change_requests
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

REVOKE ALL ON FUNCTION public.resolve_department_change_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_department_change_request(UUID, TEXT, TEXT) TO authenticated;

DROP TRIGGER IF EXISTS set_updated_at_department_change_requests
  ON public.department_change_requests;

CREATE TRIGGER set_updated_at_department_change_requests
BEFORE UPDATE ON public.department_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.department_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own department change requests"
  ON public.department_change_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view scoped department change requests"
  ON public.department_change_requests
  FOR SELECT
  TO authenticated
  USING (
    public.can_review_department_change_request(
      company_id,
      current_department_id,
      requested_department_id
    )
  );

CREATE POLICY "Users can create own department change requests"
  ON public.department_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company(auth.uid())
    AND current_department_id = public.get_user_department(auth.uid())
    AND public.is_department_assignable(requested_department_id)
    AND requested_department_id <> public.get_user_department(auth.uid())
  );

CREATE POLICY "Admins can update scoped department change requests"
  ON public.department_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.can_review_department_change_request(
      company_id,
      current_department_id,
      requested_department_id
    )
  )
  WITH CHECK (
    public.can_review_department_change_request(
      company_id,
      current_department_id,
      requested_department_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.department_change_requests TO authenticated;

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
      'department_change_rejected'
    )
  );
