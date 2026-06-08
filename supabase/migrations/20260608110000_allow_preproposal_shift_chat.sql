-- Allow employees to open a shift-scoped chat before submitting a proposal.

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
        AND (
          EXISTS (
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
          OR EXISTS (
            SELECT 1
            FROM public.shifts AS shift
            WHERE shift.id = conversations.shift_id
              AND shift.status = 'open'
              AND shift.direct_recipient_id IS NULL
              AND shift.user_id IN (participant_a_id, participant_b_id)
              AND shift.user_id <> auth.uid()
              AND public.can_access_shift_department(shift.department_id)
          )
        )
      )
    )
  );
