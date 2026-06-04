-- Direct chat proposals: private shift offers addressed to one user.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS direct_recipient_id UUID
  REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_direct_recipient
  ON public.shifts(direct_recipient_id)
  WHERE direct_recipient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair_unique
  ON public.conversations (
    LEAST(participant_a_id::TEXT, participant_b_id::TEXT),
    GREATEST(participant_a_id::TEXT, participant_b_id::TEXT)
  )
  WHERE shift_id IS NULL;

DROP POLICY IF EXISTS "Users can view scoped shifts" ON public.shifts;

CREATE POLICY "Users can view scoped shifts"
  ON public.shifts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR direct_recipient_id = auth.uid()
    OR (
      direct_recipient_id IS NULL
      AND public.can_access_shift_department(department_id)
    )
  );

DROP POLICY IF EXISTS "Users can create own shifts" ON public.shifts;

CREATE POLICY "Users can create own shifts"
  ON public.shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND department_id = public.get_user_department(auth.uid())
    AND public.is_department_assignable(department_id)
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

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (participant_a_id = auth.uid() OR participant_b_id = auth.uid())
    AND participant_a_id <> participant_b_id
    AND (
      (
        shift_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.user_profiles AS other_profile
          WHERE other_profile.id = CASE
            WHEN participant_a_id = auth.uid() THEN participant_b_id
            ELSE participant_a_id
          END
            AND other_profile.validation_status = 'approved'
            AND other_profile.company_id = public.get_user_company(auth.uid())
        )
      )
      OR (
        shift_id IS NOT NULL
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
      )
    )
  );

DROP POLICY IF EXISTS "Users can create requests" ON public.shift_requests;

CREATE POLICY "Users can create requests"
  ON public.shift_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      interested_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.shifts AS shift
        WHERE shift.id = shift_requests.shift_id
          AND shift.user_id <> auth.uid()
          AND shift.status = 'open'
          AND shift.direct_recipient_id IS NULL
          AND public.can_access_shift_department(shift.department_id)
      )
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.shifts AS shift
        WHERE shift.id = shift_requests.shift_id
          AND shift.user_id = auth.uid()
          AND shift.direct_recipient_id = shift_requests.interested_user_id
          AND shift.status = 'open'
      )
    )
  );

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'shift_request',
      'request_accepted',
      'request_rejected',
      'proposal_received',
      'proposal_accepted',
      'proposal_rejected',
      'shift_cancelled',
      'new_message',
      'exchange_confirmed',
      'exchange_signed',
      'exchange_document_added',
      'exchange_cancelled',
      'exchange_cancellation_requested',
      'exchange_cancellation_rejected',
      'exchange_pending_approval',
      'exchange_pending_validation',
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
